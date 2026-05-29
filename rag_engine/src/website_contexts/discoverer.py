"""Recursive internal URL discoverer for website ingestion.

This module performs BFS traversal of a website starting from a root URL,
normalizes discovered URLs, filters external and asset links, and returns a
list of internal URLs to crawl.

It intentionally does NOT render pages or persist HTML; those responsibilities
belong to `src.ingestion.crawler`.
"""

from __future__ import annotations

from collections import deque
from typing import Iterable, Set, List
from urllib.parse import urlparse, urljoin, urldefrag

import requests
from bs4 import BeautifulSoup

# Simple defaults; can be tuned later or moved to settings
MAX_PAGES = 300
MAX_DEPTH = 4

# file extensions to skip
_ASSET_EXTENSIONS = (
    ".pdf",
    ".zip",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".mp4",
    ".webm",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
)


def _is_asset(url: str) -> bool:
    lower = url.lower()
    return any(lower.endswith(ext) for ext in _ASSET_EXTENSIONS)


def _normalize(url: str) -> str:
    # remove fragment, strip query string to treat ?utm params as same
    url, _ = urldefrag(url)
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc
    path = parsed.path or "/"
    # remove trailing slash for normalization except root
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return f"{scheme}://{netloc}{path}"


def discover_internal_urls(root_url: str, max_pages: int = MAX_PAGES, max_depth: int = MAX_DEPTH) -> List[str]:
    """Return a list of internal URLs discovered under the root URL domain.

    Uses BFS traversal, drops query params and fragments, and skips common
    binary/asset files.
    """
    parsed_root = urlparse(root_url)
    root_netloc = parsed_root.netloc.lower()
    root_scheme = parsed_root.scheme or "https"
    start = _normalize(root_url)

    seen: Set[str] = set()
    queue = deque([(start, 0)])
    seen.add(start)
    results: List[str] = []

    session = requests.Session()
    session.headers.update({"User-Agent": "WebsiteRAGDiscoverer/1.0"})

    while queue and len(results) < max_pages:
        url, depth = queue.popleft()
        results.append(url)
        if depth >= max_depth:
            continue

        try:
            resp = session.get(url, timeout=10)
            content_type = resp.headers.get("Content-Type", "")
            if resp.status_code != 200 or "html" not in content_type.lower():
                continue
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith("mailto:") or href.startswith("javascript:"):
                    continue
                joined = urljoin(url, href)
                norm = _normalize(joined)
                if _is_asset(norm):
                    continue
                parsed = urlparse(norm)
                if parsed.netloc.lower() != root_netloc:
                    continue
                if norm in seen:
                    continue
                seen.add(norm)
                queue.append((norm, depth + 1))
                if len(seen) >= max_pages:
                    break
        except Exception:
            # Ignore fetch errors and continue
            continue

    return results
