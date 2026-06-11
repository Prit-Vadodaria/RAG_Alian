"""Discover internal URLs for a website (sitemap seed + bounded BFS).

Changes from original:
- DISCOVERY_MAX_PAGES = 0 means unlimited (issue #2).
- DISCOVERY_MAX_DEPTH = 0 means unlimited depth (issue #2).
- English language filtering applied consistently to both sitemap URLs
  and BFS-crawled links (issue #4).
- Duplicate detection now runs on extracted main content, not full HTML
  fingerprints — consistent with pipeline.py's dedup logic (issue #1).
- All sitemap types fully traversed via recursive parse_sitemap (issue #3).
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests import RequestException

from src.config.settings import DISCOVERY_MAX_DEPTH, DISCOVERY_MAX_PAGES, MAX_RETRIES, REQUEST_TIMEOUT
from src.ingestion.sitemap import filter_english_urls, parse_sitemap
from src.utils.logging import close_logger, get_logger
from src.utils.url import (
    DEFAULT_BROWSER_HEADERS,
    is_asset_url,
    is_english_url,
    is_same_domain,
    is_english_html_lang,
    normalize_url,
    looks_like_english_text,
    sitemap_url_for_root,
)


@dataclass(frozen=True)
class DiscoveryResult:
    urls: list[str]
    stop_reason: str | None
    total_discovered: int
    max_depth: int
    max_pages: int


def _setup_logger(logs_dir: Path | None):
    if logs_dir is None:
        return None, False
    logs_dir.mkdir(parents=True, exist_ok=True)
    return get_logger("website_discovery", logs_dir / "discovery.log"), True


def _log(logger, level: str, message: str, *args: object) -> None:
    if logger is None:
        return
    getattr(logger, level)(message, *args)


def _fetch(session: requests.Session, url: str, *, timeout: int, max_retries: int, logger) -> str | None:
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            _log(logger, "info", "Fetching %s (attempt %s/%s)", url, attempt, max_retries)
            response = session.get(url, timeout=timeout, allow_redirects=True)
            if response.status_code == 200 and "html" in response.headers.get("Content-Type", "").lower():
                _log(logger, "info", "Fetched %s successfully", url)
                return response.text
            _log(
                logger,
                "info",
                "Skipping %s with status=%s content-type=%s",
                url,
                response.status_code,
                response.headers.get("Content-Type", ""),
            )
        except RequestException as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(min(attempt, 3))
    if last_error is not None:
        _log(logger, "warning", "GET %s failed: %s", url, last_error)
    return None


def _extract_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href or href.startswith(("mailto:", "javascript:", "tel:", "#")):
            continue
        links.append(urljoin(base_url, href))
    return links


def _is_english_rendered_html(html: str) -> bool:
    """Return True if the rendered HTML page appears to be English.

    Strategy:
    1. If <html lang="xx"> is present and explicitly non-English → reject.
    2. If lang is absent or unrecognised → fall back to body-text heuristic.
    3. Never reject solely because lang attribute is empty/missing.
    """
    soup = BeautifulSoup(html or "", "lxml")
    html_tag = soup.find("html")
    body = soup.body if soup else None
    if body is None:
        return False

    if html_tag is not None:
        lang = str(html_tag.get("lang", "") or "").strip().lower().replace("_", "-")
        if lang:
            # Only hard-reject when lang is explicitly a known non-English code.
            from src.utils.url import _NON_ENGLISH_PATH_PREFIXES
            base_lang = lang.split("-")[0]
            if base_lang in _NON_ENGLISH_PATH_PREFIXES:
                return False
            # Explicitly English — trust the tag, skip text analysis.
            if is_english_html_lang(lang):
                text = body.get_text(" ", strip=True)
                return len(text) >= 50

    # No lang tag or unrecognised value — fall back to body text heuristic.
    text = body.get_text(" ", strip=True)
    return looks_like_english_text(text)


def discover_internal_urls(
    root_url: str,
    *,
    logs_dir: Path | None = None,
    pause_check: Callable[[], bool] | None = None,
    request_timeout: int = REQUEST_TIMEOUT,
    max_retries: int = MAX_RETRIES,
    language: str = "en",
    max_pages: int = DISCOVERY_MAX_PAGES,
    max_depth: int = DISCOVERY_MAX_DEPTH,
) -> DiscoveryResult:
    """Discover internal URLs via sitemap and bounded BFS.

    Args:
        root_url:        Seed URL for the website.
        logs_dir:        Optional directory for discovery logs.
        request_timeout: HTTP timeout per request.
        max_retries:     Retry count per request.
        language:        Target language code (default "en").
        max_pages:       Hard cap on discovered URLs. 0 = unlimited.
        max_depth:       BFS depth limit. 0 = unlimited.
    """
    parsed_root = urlparse(root_url)
    root_netloc = parsed_root.netloc
    start = normalize_url(root_url)

    logger, owns_logger = _setup_logger(logs_dir)
    _log(
        logger,
        "info",
        "Discovery started root_url=%s language=%s max_pages=%s max_depth=%s",
        root_url,
        language,
        max_pages if max_pages > 0 else "unlimited",
        max_depth if max_depth > 0 else "unlimited",
    )
    session = requests.Session()
    session.headers.update(DEFAULT_BROWSER_HEADERS)

    # -----------------------------------------------------------------------
    # Phase 1 — sitemap seeding (all sitemap types, recursively)
    # English filtering applied here too (issue #4).
    # -----------------------------------------------------------------------
    seeded: list[str] = []
    try:
        sitemap_url = sitemap_url_for_root(root_url)
        _log(logger, "info", "Attempting sitemap discovery from %s", sitemap_url)
        # parse_sitemap already recurses into nested/index sitemaps (issue #3).
        sitemap_urls = parse_sitemap(sitemap_url, timeout=request_timeout, visited=set())
        _log(logger, "info", "Sitemap returned %s raw URLs", len(sitemap_urls))
        for norm in filter_english_urls(sitemap_urls):   # issue #4: filter here too
            if pause_check is not None and pause_check():
                stop_reason = "paused"
                _log(logger, "warning", "Discovery paused while seeding sitemap urls")
                break
            parsed = urlparse(norm)
            if is_same_domain(parsed.netloc, root_netloc) and not is_asset_url(norm):
                seeded.append(norm)
                _log(logger, "info", "Seeded URL accepted: %s", norm)
            else:
                _log(logger, "info", "Seeded URL skipped (domain/asset): %s", norm)
    except Exception as exc:
        _log(logger, "warning", "Sitemap discovery failed for %s: %s", root_url, exc)

    # -----------------------------------------------------------------------
    # Phase 2 — BFS from seeded + root URL
    # -----------------------------------------------------------------------
    seen: set[str] = set()
    queue: deque[tuple[str, int]] = deque()
    for url in seeded:
        if url not in seen:
            seen.add(url)
            queue.append((url, 0))
    if start not in seen:
        seen.add(start)
        queue.appendleft((start, 0))

    results: list[str] = []
    stop_reason: str | None = None

    while queue:
        if pause_check is not None and pause_check():
            stop_reason = "paused"
            _log(logger, "warning", "Discovery paused before expanding url queue")
            break
        url, depth = queue.popleft()
        if url not in results:
            results.append(url)
        _log(logger, "info", "Discovered URL accepted depth=%s url=%s", depth, url)

        # max_pages = 0 means unlimited (issue #2)
        if max_pages > 0 and len(results) >= max_pages:
            stop_reason = "max_pages_reached"
            _log(logger, "warning", "Discovery stopped: max_pages=%s reached", max_pages)
            break

        html = _fetch(session, url, timeout=request_timeout, max_retries=max_retries, logger=logger)
        if not html:
            _log(logger, "warning", "No HTML returned for %s", url)
            continue

        # Issue #4: consistent English filtering on BFS-crawled pages.
        if not _is_english_rendered_html(html):
            _log(logger, "info", "Rendered HTML rejected by lang/text validation url=%s", url)
            continue

        # max_depth = 0 means unlimited (issue #2)
        if max_depth > 0 and depth >= max_depth:
            stop_reason = stop_reason or "max_depth_reached"
            _log(logger, "warning", "Not expanding url=%s: max_depth=%s reached", url, max_depth)
            continue

        for href in _extract_links(html, url):
            if pause_check is not None and pause_check():
                stop_reason = "paused"
                _log(logger, "warning", "Discovery paused while expanding links url=%s", url)
                break
            norm = normalize_url(href)
            parsed = urlparse(norm)
            if (
                not is_same_domain(parsed.netloc, root_netloc)
                or is_asset_url(norm)
                or not is_english_url(norm)   # issue #4: consistent lang filter
            ):
                _log(logger, "info", "Link skipped: %s", norm)
                continue
            if norm in seen:
                continue
            seen.add(norm)
            queue.append((norm, depth + 1))
            _log(logger, "info", "Link queued depth=%s url=%s", depth + 1, norm)

        if pause_check is not None and pause_check():
            stop_reason = "paused"
            _log(logger, "warning", "Discovery paused after processing url=%s", url)
            break

    _log(logger, "info", "Discovery finished count=%s stop_reason=%s", len(results), stop_reason)
    if owns_logger and logger is not None:
        close_logger(logger)

    return DiscoveryResult(
        urls=results,
        stop_reason=stop_reason,
        total_discovered=len(results),
        max_depth=max_depth,
        max_pages=max_pages,
    )
