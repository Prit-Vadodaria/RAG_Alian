"""URL normalization helpers for discovery and ingestion."""

from __future__ import annotations

import re
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

_ENGLISH_PATH_PREFIXES = {"en", "en-us", "en-gb"}
_NON_ENGLISH_PATH_PREFIXES = {
    "ar",
    "ar-sa",
    "bn",
    "de",
    "es",
    "fr",
    "fr-fr",
    "gu",
    "hi",
    "hi-in",
    "id",
    "it",
    "ja",
    "kn",
    "ko",
    "ml",
    "mr",
    "nl",
    "pa",
    "pl",
    "pt",
    "ru",
    "ta",
    "te",
    "th",
    "tr",
    "vi",
    "zh",
    "zh-cn",
    "zh-tw",
}

_ENGLISH_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "learn",
    "more",
    "not",
    "of",
    "on",
    "our",
    "read",
    "she",
    "that",
    "the",
    "their",
    "this",
    "to",
    "we",
    "welcome",
    "with",
    "you",
    "your",
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


def is_english_html_lang(lang: str | None) -> bool:
    normalized = _normalize_lang(lang)
    return normalized in _ENGLISH_PATH_PREFIXES


def looks_like_english_text(text: str, *, min_words: int = 20, min_stopwords: int = 2) -> bool:
    normalized_text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(normalized_text) < 100:
        return False

    words = re.findall(r"[A-Za-z']+", normalized_text.lower())
    if len(words) < min_words:
        return False

    english_words = sum(1 for word in words if word in _ENGLISH_STOPWORDS)
    ascii_words = sum(1 for word in words if re.fullmatch(r"[a-z']+", word))
    if ascii_words / max(len(words), 1) < 0.7:
        return False

    return english_words >= min_stopwords or (english_words / max(len(words), 1)) >= 0.03


def is_english_url(url: str) -> bool:
    parsed = urlparse(normalize_url(url))
    path = parsed.path.strip("/")
    if not path:
        return True

    first_segment = path.split("/", 1)[0].lower()
    normalized_segment = _normalize_lang(first_segment)
    if normalized_segment in _NON_ENGLISH_PATH_PREFIXES:
        return False
    if normalized_segment in _ENGLISH_PATH_PREFIXES:
        return True

    # Reject obvious localized variants such as /fr-fr/ or /zh-cn/.
    if re.fullmatch(r"[a-z]{2}(?:-[a-z]{2})?", normalized_segment) and normalized_segment not in _ENGLISH_PATH_PREFIXES:
        return False

    return True


def _normalize_lang(value: str | None) -> str:
    return str(value or "").strip().lower().replace("_", "-")
