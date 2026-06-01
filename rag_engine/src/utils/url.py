"""URL normalization helpers for discovery and ingestion."""

from __future__ import annotations

from urllib.parse import urljoin, urlparse, urlunparse

DEFAULT_BROWSER_HEADERS = {
    "User-Agent": "WebsiteRAGCrawler/1.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_ASSET_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".pdf",
    ".zip",
    ".mp4",
    ".mp3",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}


def normalize_netloc(netloc: str) -> str:
    host = (netloc or "").strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def normalize_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    scheme = parsed.scheme.lower() if parsed.scheme else "https"
    netloc = normalize_netloc(parsed.netloc)
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    normalized = urlunparse((scheme, netloc, path, "", parsed.query, ""))
    return normalized


def is_asset_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in _ASSET_EXTENSIONS)


def is_same_domain(left_netloc: str, right_netloc: str) -> bool:
    return normalize_netloc(left_netloc) == normalize_netloc(right_netloc)


def sitemap_url_for_root(root_url: str) -> str:
    parsed = urlparse(normalize_url(root_url))
    return f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"


def urls_equivalent(left: str, right: str) -> bool:
    return normalize_url(left) == normalize_url(right)
