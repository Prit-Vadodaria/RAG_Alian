"""Browser-based website crawler for Phase 2.

This module fetches fully rendered HTML using Playwright and saves raw HTML
snapshots for later extraction phases. It intentionally does not clean,
transform, chunk, or embed content.
"""

from __future__ import annotations

import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib import robotparser
from urllib.parse import urlparse

from src.config.settings import (
    ALLOWED_CRAWL_DOMAINS,
    CRAWL_AUDIT_FILE,
    CRAWL_MANIFEST_FILE,
    CRAWL_DELAY_SECONDS,
    MAX_RETRIES,
    RAW_HTML_DIR,
    REQUEST_TIMEOUT,
    RESPECT_ROBOTS_TXT,
    SITEMAP_URLS_FILE,
)

DEFAULT_USER_AGENT = "WebsiteRAGCrawler/1.0"


@dataclass(frozen=True)
class CrawlResult:
    """Outcome for a single crawled URL."""

    url: str
    output_path: Path | None
    success: bool
    error: str | None = None
    status: str = "success"
    content_hash: str | None = None


@dataclass(frozen=True)
class CrawlAuditRecord:
    """JSONL-serializable crawl audit event."""

    url: str
    status: str
    output_path: str | None
    error: str | None
    crawled_at: str


@dataclass(frozen=True)
class CrawlManifestEntry:
    """Last known crawl state for one URL."""

    url: str
    status: str
    output_path: str | None
    content_hash: str | None
    last_crawled_at: str | None
    tombstoned_at: str | None = None


def read_urls(url_file: Path = SITEMAP_URLS_FILE) -> list[str]:
    """Read one URL per line from the Phase 1 sitemap output."""
    if not url_file.exists():
        return []

    return [line.strip() for line in url_file.read_text(encoding="utf-8").splitlines() if line.strip()]


def output_path_for_url(url: str, output_dir: Path = RAW_HTML_DIR) -> Path:
    """Create a stable, filesystem-safe HTML snapshot path for a URL."""
    parsed = urlparse(url)
    path_part = parsed.path.strip("/").replace("/", "_") or "home"
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:10]
    filename = f"{parsed.netloc}_{path_part}_{digest}.html"
    safe_filename = "".join(char if char.isalnum() or char in "._-" else "_" for char in filename)

    return output_dir / safe_filename


def save_raw_html(url: str, html: str, output_dir: Path = RAW_HTML_DIR) -> Path:
    """Persist raw rendered HTML with the source URL recorded as a comment."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_path_for_url(url, output_dir)
    output_path.write_text(f"<!-- source_url: {url} -->\n{html}", encoding="utf-8")
    return output_path


class WebsiteCrawler:
    """Fetch rendered page HTML with one reusable Playwright browser."""

    def __init__(
        self,
        *,
        timeout_seconds: int = REQUEST_TIMEOUT,
        max_retries: int = MAX_RETRIES,
        headless: bool = True,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.timeout_ms = timeout_seconds * 1000
        self.max_retries = max_retries
        self.headless = headless
        self.user_agent = user_agent
        self.playwright = None
        self.browser = None

    def __enter__(self) -> "WebsiteCrawler":
        self.start()
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.close()

    def start(self) -> None:
        """Start Playwright and launch Chromium."""
        if self.browser is not None:
            return

        from playwright.sync_api import sync_playwright

        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)

    def crawl_page(self, url: str) -> str:
        """Return fully rendered HTML for one URL."""
        if self.browser is None:
            self.start()

        page = self.browser.new_page(user_agent=self.user_agent)
        try:
            page.goto(url, wait_until="networkidle", timeout=self.timeout_ms)
            return page.content()
        finally:
            page.close()

    def crawl_page_with_retries(self, url: str) -> str:
        """Fetch one page, retrying transient browser/navigation failures."""
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                return self.crawl_page(url)
            except Exception as exc:  # Playwright raises several runtime exception types.
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(min(attempt, 3))

        raise RuntimeError(f"Failed to crawl {url}") from last_error

    def close(self) -> None:
        """Close browser resources."""
        if self.browser is not None:
            self.browser.close()
            self.browser = None

        if self.playwright is not None:
            self.playwright.stop()
            self.playwright = None


def crawl_urls(
    urls: list[str],
    *,
    output_dir: Path = RAW_HTML_DIR,
    limit: int | None = None,
    crawler: WebsiteCrawler | None = None,
    allowed_domains: Iterable[str] | None = ALLOWED_CRAWL_DOMAINS,
    respect_robots: bool = RESPECT_ROBOTS_TXT,
    crawl_delay_seconds: float = CRAWL_DELAY_SECONDS,
    audit_file: Path | None = CRAWL_AUDIT_FILE,
    manifest_file: Path | None = CRAWL_MANIFEST_FILE,
    user_agent: str = DEFAULT_USER_AGENT,
    workers: int = 1,
) -> list[CrawlResult]:
    """Crawl URLs and persist raw rendered HTML snapshots."""
    selected_urls = urls[:limit] if limit is not None else urls
    allowed_domain_set = _normalize_domains(allowed_domains)
    manifest = load_crawl_manifest(manifest_file)

    if workers > 1 and crawler is None:
        indexed_results = _crawl_urls_parallel(
            selected_urls,
            workers=workers,
            output_dir=output_dir,
            allowed_domain_set=allowed_domain_set,
            respect_robots=respect_robots,
            crawl_delay_seconds=crawl_delay_seconds,
            user_agent=user_agent,
        )
        results = [result for _, result in sorted(indexed_results, key=lambda item: item[0])]
    else:
        results = _crawl_urls_serial(
            selected_urls,
            output_dir=output_dir,
            crawler=crawler,
            allowed_domain_set=allowed_domain_set,
            respect_robots=respect_robots,
            crawl_delay_seconds=crawl_delay_seconds,
            user_agent=user_agent,
        )

    for result in results:
        _append_audit_record(result, audit_file)

    if manifest_file is not None:
        update_crawl_manifest(manifest, results, selected_urls, manifest_file, tombstone_missing=limit is None)

    return results


def _crawl_urls_serial(
    urls: list[str],
    *,
    output_dir: Path,
    crawler: WebsiteCrawler | None,
    allowed_domain_set: set[str],
    respect_robots: bool,
    crawl_delay_seconds: float,
    user_agent: str,
) -> list[CrawlResult]:
    results: list[CrawlResult] = []
    robots_cache: dict[str, robotparser.RobotFileParser] = {}
    last_request_at: dict[str, float] = {}
    active_crawler = crawler or WebsiteCrawler(user_agent=user_agent)
    owns_crawler = crawler is None

    try:
        if owns_crawler:
            active_crawler.start()

        for url in urls:
            results.append(
                _crawl_one_url(
                    url,
                    output_dir=output_dir,
                    crawler=active_crawler,
                    allowed_domain_set=allowed_domain_set,
                    respect_robots=respect_robots,
                    robots_cache=robots_cache,
                    last_request_at=last_request_at,
                    crawl_delay_seconds=crawl_delay_seconds,
                    user_agent=user_agent,
                )
            )
    finally:
        if owns_crawler:
            active_crawler.close()

    return results


def _crawl_urls_parallel(
    urls: list[str],
    *,
    workers: int,
    output_dir: Path,
    allowed_domain_set: set[str],
    respect_robots: bool,
    crawl_delay_seconds: float,
    user_agent: str,
) -> list[tuple[int, CrawlResult]]:
    indexed_urls = list(enumerate(urls))
    batches = [indexed_urls[index::workers] for index in range(workers)]
    indexed_results: list[tuple[int, CrawlResult]] = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(
                _crawl_url_batch,
                batch,
                output_dir,
                allowed_domain_set,
                respect_robots,
                crawl_delay_seconds,
                user_agent,
            )
            for batch in batches
            if batch
        ]
        for future in as_completed(futures):
            indexed_results.extend(future.result())

    return indexed_results


def _crawl_url_batch(
    indexed_urls: list[tuple[int, str]],
    output_dir: Path,
    allowed_domain_set: set[str],
    respect_robots: bool,
    crawl_delay_seconds: float,
    user_agent: str,
) -> list[tuple[int, CrawlResult]]:
    robots_cache: dict[str, robotparser.RobotFileParser] = {}
    last_request_at: dict[str, float] = {}
    results: list[tuple[int, CrawlResult]] = []

    with WebsiteCrawler(user_agent=user_agent) as crawler:
        for index, url in indexed_urls:
            result = _crawl_one_url(
                url,
                output_dir=output_dir,
                crawler=crawler,
                allowed_domain_set=allowed_domain_set,
                respect_robots=respect_robots,
                robots_cache=robots_cache,
                last_request_at=last_request_at,
                crawl_delay_seconds=crawl_delay_seconds,
                user_agent=user_agent,
            )
            results.append((index, result))

    return results


def _crawl_one_url(
    url: str,
    *,
    output_dir: Path,
    crawler: WebsiteCrawler,
    allowed_domain_set: set[str],
    respect_robots: bool,
    robots_cache: dict[str, robotparser.RobotFileParser],
    last_request_at: dict[str, float],
    crawl_delay_seconds: float,
    user_agent: str,
) -> CrawlResult:
    parsed = urlparse(url)
    try:
        if not _is_allowed_domain(parsed.netloc, allowed_domain_set):
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error="URL host is outside the allowed crawl domains.",
                status="blocked_domain",
            )

        if respect_robots and not _can_fetch(url, user_agent, robots_cache):
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error="Blocked by robots.txt.",
                status="blocked_robots",
            )

        _respect_crawl_delay(parsed.netloc, last_request_at, crawl_delay_seconds)
        html = crawler.crawl_page_with_retries(url)
        output_path = save_raw_html(url, html, output_dir)
        return CrawlResult(
            url=url,
            output_path=output_path,
            success=True,
            content_hash=hashlib.sha256(html.encode("utf-8")).hexdigest(),
        )
    except Exception as exc:
        return CrawlResult(url=url, output_path=None, success=False, error=str(exc), status="failed")


def _normalize_domains(domains: Iterable[str] | None) -> set[str]:
    return {domain.strip().lower() for domain in domains or () if domain.strip()}


def _is_allowed_domain(host: str, allowed_domains: set[str]) -> bool:
    if not allowed_domains:
        return True

    normalized_host = host.lower()
    return any(normalized_host == domain or normalized_host.endswith(f".{domain}") for domain in allowed_domains)


def _can_fetch(
    url: str,
    user_agent: str,
    robots_cache: dict[str, robotparser.RobotFileParser],
) -> bool:
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin not in robots_cache:
        robots = robotparser.RobotFileParser()
        robots.set_url(f"{origin}/robots.txt")
        try:
            robots.read()
        except Exception:
            return True
        robots_cache[origin] = robots

    return robots_cache[origin].can_fetch(user_agent, url)


def _respect_crawl_delay(host: str, last_request_at: dict[str, float], delay_seconds: float) -> None:
    if delay_seconds <= 0:
        return

    now = time.monotonic()
    previous = last_request_at.get(host)
    if previous is not None:
        remaining = delay_seconds - (now - previous)
        if remaining > 0:
            time.sleep(remaining)

    last_request_at[host] = time.monotonic()


def _append_audit_record(result: CrawlResult, audit_file: Path | None) -> None:
    if audit_file is None:
        return

    audit_file.parent.mkdir(parents=True, exist_ok=True)
    record = CrawlAuditRecord(
        url=result.url,
        status=result.status,
        output_path=str(result.output_path) if result.output_path else None,
        error=result.error,
        crawled_at=datetime.now(timezone.utc).isoformat(),
    )
    with audit_file.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record.__dict__, ensure_ascii=False) + "\n")


def load_crawl_manifest(manifest_file: Path | None = CRAWL_MANIFEST_FILE) -> dict[str, CrawlManifestEntry]:
    """Load last known crawl state keyed by URL."""
    if manifest_file is None or not manifest_file.exists():
        return {}

    try:
        raw = json.loads(manifest_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(raw, dict):
        return {}

    manifest: dict[str, CrawlManifestEntry] = {}
    for url, entry in raw.items():
        if not isinstance(url, str) or not isinstance(entry, dict):
            continue
        manifest[url] = CrawlManifestEntry(
            url=str(entry.get("url") or url),
            status=str(entry.get("status") or "unknown"),
            output_path=str(entry["output_path"]) if entry.get("output_path") else None,
            content_hash=str(entry["content_hash"]) if entry.get("content_hash") else None,
            last_crawled_at=str(entry["last_crawled_at"]) if entry.get("last_crawled_at") else None,
            tombstoned_at=str(entry["tombstoned_at"]) if entry.get("tombstoned_at") else None,
        )

    return manifest


def update_crawl_manifest(
    manifest: dict[str, CrawlManifestEntry],
    results: list[CrawlResult],
    active_urls: list[str],
    manifest_file: Path,
    *,
    tombstone_missing: bool = True,
) -> None:
    """Persist crawl state and mark previously known missing URLs as tombstoned."""
    now = datetime.now(timezone.utc).isoformat()
    active_url_set = set(active_urls)
    next_manifest = dict(manifest)

    for result in results:
        next_manifest[result.url] = CrawlManifestEntry(
            url=result.url,
            status=result.status,
            output_path=str(result.output_path) if result.output_path else None,
            content_hash=result.content_hash,
            last_crawled_at=now,
            tombstoned_at=None,
        )

    if tombstone_missing:
        for url, entry in manifest.items():
            if url in active_url_set or entry.tombstoned_at is not None:
                continue
            next_manifest[url] = CrawlManifestEntry(
                url=entry.url,
                status="tombstoned",
                output_path=entry.output_path,
                content_hash=entry.content_hash,
                last_crawled_at=entry.last_crawled_at,
                tombstoned_at=now,
            )

    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        url: {
            "url": entry.url,
            "status": entry.status,
            "output_path": entry.output_path,
            "content_hash": entry.content_hash,
            "last_crawled_at": entry.last_crawled_at,
            "tombstoned_at": entry.tombstoned_at,
        }
        for url, entry in sorted(next_manifest.items())
    }
    manifest_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

