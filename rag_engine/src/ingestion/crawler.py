"""Browser-based website crawler for Phase 2.

This module fetches fully rendered HTML using Playwright and saves raw HTML
snapshots for later extraction phases. It intentionally does not clean,
transform, chunk, or embed content.
"""

from __future__ import annotations

import hashlib
import json
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable
from urllib import robotparser
from urllib.parse import urlparse

from bs4 import BeautifulSoup
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
from src.utils.url import is_english_html_lang, looks_like_english_text
from src.utils.logging import close_logger, get_logger

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)
BLOCKED_URL_PATTERNS = (
    "/cart",
    "/checkout",
    "/account",
    "/search",
    "/collections/all",
)
BLOCKED_QUERY_PATTERNS = ("variant=", "sort=", "page=")
BLOCKED_CONTENT_PATTERNS = (
    "captcha",
    "access denied",
    "verify you are human",
    "unusual traffic",
    "robot check",
    "forbidden",
    "cloudflare",
    "blocked",
)
MIN_SAVED_HTML_LENGTH = 5000
MIN_SAVED_TEXT_LENGTH = 200
MIN_DOM_NODES = 20
MIN_BODY_TEXT_LENGTH = 200
RETRYABLE_BROWSER_ERROR_PATTERNS = (
    "timeout",
    "navigation",
    "target closed",
    "browser has been closed",
    "execution context was destroyed",
    "execution context destroyed",
    "frame was detached",
    "net::err",
    "protocol error",
)


class NonRetryableCrawlError(RuntimeError):
    """Raised for content that should not be retried."""


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
    """Persist cleaned rendered HTML with the source URL recorded as a comment."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_path_for_url(url, output_dir)
    cleaned_html = _clean_html_for_save(html)
    _validate_saved_html(url, cleaned_html)
    output_path.write_text(f"<!-- source_url: {url} -->\n{cleaned_html}", encoding="utf-8")
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
        self.context = None

    def __enter__(self) -> "WebsiteCrawler":
        self.start()
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.close()

    def start(self) -> None:
        """Start Playwright and launch Chromium."""
        if self.browser is not None and self.context is not None:
            return

        from playwright.sync_api import sync_playwright

        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
            ],
        )
        self.context = self.browser.new_context(
            user_agent=self.user_agent,
            viewport={"width": 1440, "height": 900},
            java_script_enabled=True,
            locale="en-US",
        )
        self.context.route("**/*", self._block_resource_requests)

    def crawl_page(self, url: str) -> str:
        """Return fully rendered HTML for one URL."""
        if self.browser is None:
            self.start()

        assert self.context is not None
        page = self.context.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
            try:
                page.wait_for_load_state("networkidle", timeout=min(self.timeout_ms, 15000))
            except Exception:
                pass
            self._wait_for_dom_stability(page)
            self._auto_scroll(page)
            try:
                page.wait_for_load_state("networkidle", timeout=min(self.timeout_ms, 15000))
            except Exception:
                pass
            self._wait_for_dom_stability(page)
            return page.content()
        finally:
            page.close()

    def crawl_page_with_retries(self, url: str) -> str:
        """Fetch one page, retrying transient browser/navigation failures."""
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                return self.crawl_page(url)
            except NonRetryableCrawlError:
                raise
            except Exception as exc:  # Playwright raises several runtime exception types.
                last_error = exc
                retryable = _is_retryable_browser_error(exc)
                if retryable and attempt < self.max_retries:
                    time.sleep(min(attempt, 3))
                    continue
                raise

        raise RuntimeError(f"Failed to crawl {url}") from last_error

    def close(self) -> None:
        """Close browser resources."""
        if self.browser is not None:
            self.browser.close()
            self.browser = None

        if self.playwright is not None:
            self.playwright.stop()
            self.playwright = None
        self.context = None

    def _block_resource_requests(self, route) -> None:
        resource_type = getattr(route.request, "resource_type", "")
        if resource_type in {"image", "media", "font"}:
            route.abort()
            return
        route.continue_()

    def _auto_scroll(self, page) -> None:
        try:
            for _ in range(3):
                page.evaluate(
                    """() => {
                        window.scrollTo(0, document.body.scrollHeight);
                    }""",
                )
                page.wait_for_timeout(500)
        except Exception:
            return

    def _wait_for_dom_stability(self, page) -> None:
        try:
            previous = ""
            for _ in range(4):
                current = page.evaluate(
                    """() => {
                        const body = document.body ? document.body.innerText || '' : '';
                        return body.trim().slice(0, 20000);
                    }""",
                )
                if current == previous and current:
                    return
                previous = current
                page.wait_for_timeout(750)
        except Exception:
            return


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
    logs_dir: Path | None = None,
    pause_check: Callable[[], bool] | None = None,
) -> list[CrawlResult]:
    """Crawl URLs and persist raw rendered HTML snapshots."""
    selected_urls = urls[:limit] if limit is not None else urls
    allowed_domain_set = _normalize_domains(allowed_domains)
    manifest = load_crawl_manifest(manifest_file)
    logger, owns_logger = _setup_logger(logs_dir)
    _log(logger, "info", "Crawl started total_urls=%s workers=%s output_dir=%s", len(selected_urls), workers, output_dir)

    try:
        if workers > 1 and crawler is None:
            indexed_results = _crawl_urls_parallel(
                selected_urls,
                workers=workers,
                output_dir=output_dir,
                allowed_domain_set=allowed_domain_set,
                respect_robots=respect_robots,
                crawl_delay_seconds=crawl_delay_seconds,
                user_agent=user_agent,
                logger=logger,
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
                pause_check=pause_check,
                logger=logger,
            )

        for result in results:
            _append_audit_record(result, audit_file)

        if manifest_file is not None:
            update_crawl_manifest(manifest, results, selected_urls, manifest_file, tombstone_missing=limit is None)

        _log(
            logger,
            "info",
            "Crawl finished success=%s failed=%s",
            sum(1 for item in results if item.success),
            sum(1 for item in results if not item.success),
        )
        return results
    finally:
        if owns_logger and logger is not None:
            close_logger(logger)


def _crawl_urls_serial(
    urls: list[str],
    *,
    output_dir: Path,
    crawler: WebsiteCrawler | None,
    allowed_domain_set: set[str],
    respect_robots: bool,
    crawl_delay_seconds: float,
    user_agent: str,
    pause_check,
    logger,
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
            if pause_check is not None and pause_check():
                break
            _log(logger, "info", "Crawling URL %s", url)
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
                    logger=logger,
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
    pause_check,
    logger,
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
                pause_check,
                logger,
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
    pause_check,
    logger,
) -> list[tuple[int, CrawlResult]]:
    robots_cache: dict[str, robotparser.RobotFileParser] = {}
    last_request_at: dict[str, float] = {}
    results: list[tuple[int, CrawlResult]] = []

    with WebsiteCrawler(user_agent=user_agent) as crawler:
        for index, url in indexed_urls:
            if pause_check is not None and pause_check():
                break
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
                logger=logger,
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
    pause_check,
    logger,
) -> CrawlResult:
    parsed = urlparse(url)
    try:
        skip_reason = _should_skip_url(url)
        if skip_reason is not None:
            _log(logger, "info", "Skipped URL url=%s reason=%s", url, skip_reason)
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error=skip_reason,
                status="skipped_url",
            )

        if not _is_allowed_domain(parsed.netloc, allowed_domain_set):
            _log(logger, "info", "Blocked by domain rules url=%s", url)
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error="URL host is outside the allowed crawl domains.",
                status="blocked_domain",
            )

        if respect_robots and not _can_fetch(url, user_agent, robots_cache):
            _log(logger, "info", "Blocked by robots.txt url=%s", url)
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error="Blocked by robots.txt.",
                status="blocked_robots",
            )

        _respect_crawl_delay(parsed.netloc, last_request_at, crawl_delay_seconds)
        if pause_check is not None and pause_check():
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error="Paused before fetch.",
                status="paused",
            )
        _log(logger, "info", "Fetching rendered page url=%s", url)
        html = crawler.crawl_page_with_retries(url)
        output_path = save_raw_html(url, html, output_dir)
        _log(logger, "info", "Saved raw HTML url=%s path=%s bytes=%s", url, output_path, len(html.encode("utf-8")))
        return CrawlResult(
            url=url,
            output_path=output_path,
            success=True,
            content_hash=hashlib.sha256(html.encode("utf-8")).hexdigest(),
        )
    except Exception as exc:
        if isinstance(exc, NonRetryableCrawlError):
            _log(logger, "info", "Rejected rendered page url=%s reason=%s", url, exc)
            return CrawlResult(
                url=url,
                output_path=None,
                success=False,
                error=str(exc),
                status="blocked_content",
            )
        _log(logger, "warning", "Failed crawling url=%s error=%s", url, exc)
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


def _should_skip_url(url: str) -> str | None:
    parsed = urlparse(url)
    path = parsed.path.lower().rstrip("/")
    segments = [segment for segment in path.split("/") if segment]

    if segments:
        first_segment = segments[0]
        if first_segment in {"cart", "checkout", "account", "search"}:
            return f"blocked path {first_segment}"
        if len(segments) >= 2 and segments[0] == "collections" and segments[1] == "all":
            return "blocked path collections/all"

    query = parsed.query.lower()
    for blocked_param in BLOCKED_QUERY_PATTERNS:
        if re.search(rf"(?:^|&){re.escape(blocked_param)}(?:=|&|$)", query):
            return f"blocked query parameter {blocked_param}"

    for blocked_pattern in BLOCKED_URL_PATTERNS:
        if blocked_pattern in path:
            return f"blocked path {blocked_pattern}"

    return None


def _clean_html_for_save(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag_name in ("script", "style", "noscript", "svg"):
        for tag in soup.find_all(tag_name):
            tag.decompose()
    return str(soup)


def _validate_saved_html(url: str, html: str) -> None:
    soup = BeautifulSoup(html, "html.parser")
    lower_html = html.lower()
    if len(html.strip()) < MIN_SAVED_HTML_LENGTH:
        raise NonRetryableCrawlError(f"Page content too small for {url}")

    if soup.find("html") is None or soup.find("head") is None or soup.find("body") is None:
        raise NonRetryableCrawlError(f"Invalid rendered HTML structure for {url}")

    if len(soup.find_all(True)) < MIN_DOM_NODES:
        raise NonRetryableCrawlError(f"Rendered DOM too small for {url}")

    html_tag = soup.find("html")
    if html_tag is None:
        raise NonRetryableCrawlError(f"Invalid rendered HTML structure for {url}")

    lang = html_tag.get("lang")
    body = soup.body
    if body is None:
        raise NonRetryableCrawlError(f"Invalid rendered HTML structure for {url}")

    if lang and not is_english_html_lang(lang):
        raise NonRetryableCrawlError(f"Non-English or missing html lang for {url}")

    if any(pattern in lower_html for pattern in BLOCKED_CONTENT_PATTERNS):
        raise NonRetryableCrawlError(f"Blocked or challenge page detected for {url}")

    text = body.get_text(" ", strip=True)
    if len(text) < MIN_SAVED_TEXT_LENGTH or len(text) < MIN_BODY_TEXT_LENGTH:
        raise NonRetryableCrawlError(f"Page text too small for {url}")

    visible_text = text.lower()
    if any(pattern in visible_text for pattern in BLOCKED_CONTENT_PATTERNS):
        raise NonRetryableCrawlError(f"Blocked or challenge page detected for {url}")

    if not lang and not looks_like_english_text(text):
        raise NonRetryableCrawlError(f"Non-English or missing html lang for {url}")


def _is_retryable_browser_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(pattern in message for pattern in RETRYABLE_BROWSER_ERROR_PATTERNS)


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


def _setup_logger(logs_dir: Path | None):
    if logs_dir is None:
        return None, False
    logs_dir.mkdir(parents=True, exist_ok=True)
    return get_logger("website_crawl", logs_dir / "crawl.log"), True


def _log(logger, level: str, message: str, *args: object) -> None:
    if logger is None:
        return
    getattr(logger, level)(message, *args)


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

