"""Sitemap ingestion utilities."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from requests import RequestException

from src.config.settings import LOGS_DIR, REQUEST_TIMEOUT, SITEMAP_URLS_FILE, ensure_directories
from src.utils.url import is_english_url
from src.utils.logging import get_logger

HTTP_SCHEMES = {"http", "https"}
visited_sitemaps: set[str] = set()


def is_valid_url(url: str) -> bool:
    parsed = urlparse(url.strip())
    return parsed.scheme in HTTP_SCHEMES and bool(parsed.netloc)


def _dedupe_preserving_order(urls: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    unique_urls: list[str] = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    return unique_urls


def filter_urls_by_language(urls: Iterable[str], language: str = "en") -> list[str]:
    language_prefix = f"/{language.strip('/')}"
    filtered_urls: list[str] = []
    for url in urls:
        parsed = urlparse(url.strip())
        if parsed.path == language_prefix or parsed.path.startswith(f"{language_prefix}/"):
            filtered_urls.append(url.strip())
    return _dedupe_preserving_order(filtered_urls)


def filter_english_urls(urls: Iterable[str]) -> list[str]:
    filtered_urls: list[str] = []
    for url in urls:
        candidate = url.strip()
        if candidate and is_english_url(candidate):
            filtered_urls.append(candidate)
    return _dedupe_preserving_order(filtered_urls)


def _fetch_sitemap_xml(sitemap_url: str, timeout: int) -> bytes | None:
    try:
        response = requests.get(sitemap_url, timeout=timeout)
        response.raise_for_status()
    except RequestException as exc:
        logger = get_logger("sitemap_parser", LOGS_DIR / "sitemap.log")
        logger.warning("Failed fetching sitemap %s: %s", sitemap_url, exc)
        return None
    return response.content


def _is_allowed_url(url: str, language: str | None) -> bool:
    if not language:
        return True
    normalized_language = language.strip().lower()
    if normalized_language == "en":
        return is_english_url(url)
    return bool(filter_urls_by_language([url], normalized_language))


def _loc_texts(soup: BeautifulSoup, parent_tag: str) -> list[str]:
    locations: list[str] = []
    for parent in soup.find_all(parent_tag):
        loc = parent.find("loc")
        if loc and loc.get_text(strip=True):
            locations.append(loc.get_text(strip=True))
    return locations


def parse_sitemap(
    sitemap_url: str,
    *,
    timeout: int = REQUEST_TIMEOUT,
    visited: set[str] | None = None,
    language: str | None = "en",
) -> list[str]:
    if not is_valid_url(sitemap_url):
        logger = get_logger("sitemap_parser", LOGS_DIR / "sitemap.log")
        logger.warning("Skipped invalid sitemap URL: %s", sitemap_url)
        return []

    active_visited = visited if visited is not None else visited_sitemaps
    normalized_sitemap_url = sitemap_url.strip()
    if normalized_sitemap_url in active_visited:
        return []
    if not _is_allowed_url(normalized_sitemap_url, language):
        return []
    active_visited.add(normalized_sitemap_url)

    xml_content = _fetch_sitemap_xml(normalized_sitemap_url, timeout)
    if not xml_content:
        return []

    soup = BeautifulSoup(xml_content, "xml")
    discovered_urls: list[str] = []
    for nested_sitemap_url in _loc_texts(soup, "sitemap"):
        discovered_urls.extend(
            parse_sitemap(
                nested_sitemap_url,
                timeout=timeout,
                visited=active_visited,
                language=language,
            )
        )
    for page_url in _loc_texts(soup, "url"):
        candidate = page_url.strip()
        if is_valid_url(candidate) and _is_allowed_url(candidate, language):
            discovered_urls.append(candidate)
    return _dedupe_preserving_order(discovered_urls)


def save_urls(urls: Iterable[str], output_path: Path = SITEMAP_URLS_FILE) -> Path:
    ensure_directories()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    unique_urls = _dedupe_preserving_order(url.strip() for url in urls if url.strip())
    output = "\n".join(unique_urls)
    output_path.write_text(f"{output}\n" if output else "", encoding="utf-8")
    return output_path


def parse_and_save_sitemap(
    sitemap_url: str,
    *,
    output_path: Path = SITEMAP_URLS_FILE,
    timeout: int = REQUEST_TIMEOUT,
    language: str | None = None,
) -> list[str]:
    urls = parse_sitemap(sitemap_url, timeout=timeout, visited=set(), language=language or "en")
    urls = filter_english_urls(urls)
    if language:
        urls = filter_urls_by_language(urls, language)
    save_urls(urls, output_path)
    return urls
