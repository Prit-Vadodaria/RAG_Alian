"""Metadata extraction for raw and cleaned HTML documents."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path

from bs4 import BeautifulSoup


@dataclass(frozen=True)
class DocumentMetadata:
    """Metadata carried through document and chunk exports."""

    title: str
    url: str
    description: str
    canonical_url: str
    language: str
    headings: list[str]
    last_modified: str
    source_file: str

    def to_dict(self) -> dict[str, object]:
        """Serialize metadata for JSON export."""
        return asdict(self)


def extract_source_url(html: str) -> str:
    """Read source URL injected by the crawler, when present."""
    match = re.search(r"<!--\s*source_url:\s*(.*?)\s*-->", html)
    return match.group(1).strip() if match else ""


def extract_metadata(raw_html: str, cleaned_html: str, source_file: Path) -> DocumentMetadata:
    """Extract page metadata and structural heading information."""
    raw_soup = BeautifulSoup(raw_html, "html.parser")
    cleaned_soup = BeautifulSoup(cleaned_html, "html.parser")

    title = _first_text(raw_soup, ["title", "h1"])
    description = _meta_content(raw_soup, "description")
    canonical = _canonical_url(raw_soup)
    url = extract_source_url(raw_html) or canonical
    language = _language(raw_soup)
    headings = [
        heading.get_text(" ", strip=True)
        for heading in cleaned_soup.find_all(["h1", "h2", "h3"])
        if heading.get_text(" ", strip=True)
    ]
    last_modified = _meta_content(raw_soup, "last-modified") or _meta_content(raw_soup, "article:modified_time")

    return DocumentMetadata(
        title=title,
        url=url,
        description=description,
        canonical_url=canonical,
        language=language,
        headings=headings,
        last_modified=last_modified,
        source_file=str(source_file),
    )


def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str:
    for selector in selectors:
        element = soup.select_one(selector)
        if element and element.get_text(" ", strip=True):
            return element.get_text(" ", strip=True)
    return ""


def _meta_content(soup: BeautifulSoup, name: str) -> str:
    element = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": name})
    value = element.get("content", "") if element else ""
    return str(value).strip()


def _canonical_url(soup: BeautifulSoup) -> str:
    element = soup.find("link", attrs={"rel": "canonical"})
    value = element.get("href", "") if element else ""
    return str(value).strip()


def _language(soup: BeautifulSoup) -> str:
    html = soup.find("html")
    value = html.get("lang", "") if html else ""
    return str(value).strip()

