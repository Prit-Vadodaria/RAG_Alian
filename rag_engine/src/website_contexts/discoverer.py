"""Discover internal URLs for a website (sitemap seed + shallow BFS)."""

from __future__ import annotations

import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests import RequestException

from src.config.settings import DISCOVERY_MAX_DEPTH, DISCOVERY_MAX_PAGES, MAX_RETRIES, REQUEST_TIMEOUT
from src.ingestion.sitemap import parse_sitemap
from src.utils.logging import close_logger, get_logger
from src.utils.url import (
    DEFAULT_BROWSER_HEADERS,
    is_asset_url,
    is_same_domain,
    normalize_url,
    sitemap_url_for_root,
)


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
            response = session.get(url, timeout=timeout, allow_redirects=True)
            if response.status_code == 200 and "html" in response.headers.get("Content-Type", "").lower():
                return response.text
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


def discover_internal_urls(
    root_url: str,
    max_pages: int = DISCOVERY_MAX_PAGES,
    max_depth: int = DISCOVERY_MAX_DEPTH,
    *,
    logs_dir: Path | None = None,
    request_timeout: int = REQUEST_TIMEOUT,
    max_retries: int = MAX_RETRIES,
) -> list[str]:
    """Discover internal URLs via sitemap and bounded BFS."""
    parsed_root = urlparse(root_url)
    root_netloc = parsed_root.netloc
    start = normalize_url(root_url)

    logger, owns_logger = _setup_logger(logs_dir)
    session = requests.Session()
    session.headers.update(DEFAULT_BROWSER_HEADERS)

    seeded: list[str] = []
    try:
        sitemap_url = sitemap_url_for_root(root_url)
        for raw in parse_sitemap(sitemap_url, timeout=request_timeout, visited=set()):
            norm = normalize_url(raw)
            if is_same_domain(urlparse(norm).netloc, root_netloc) and not is_asset_url(norm):
                seeded.append(norm)
                if len(seeded) >= max_pages:
                    break
    except Exception as exc:
        _log(logger, "warning", "Sitemap discovery failed for %s: %s", root_url, exc)

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
    while queue and len(results) < max_pages:
        url, depth = queue.popleft()
        results.append(url)
        if depth >= max_depth:
            continue

        html = _fetch(session, url, timeout=request_timeout, max_retries=max_retries, logger=logger)
        if not html:
            continue
        for href in _extract_links(html, url):
            norm = normalize_url(href)
            parsed = urlparse(norm)
            if not is_same_domain(parsed.netloc, root_netloc) or is_asset_url(norm):
                continue
            if norm in seen:
                continue
            seen.add(norm)
            queue.append((norm, depth + 1))
            if len(seen) >= max_pages:
                break

    if owns_logger and logger is not None:
        close_logger(logger)
    return results
