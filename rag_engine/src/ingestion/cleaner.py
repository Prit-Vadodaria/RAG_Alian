"""HTML parsing, boilerplate removal, and main-content extraction."""

from __future__ import annotations

import re
from dataclasses import dataclass

from bs4 import BeautifulSoup

REMOVE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "form",
    "input",
    "button",
    "nav",
    "footer",
    "header",
    "aside",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    ".cookie",
    ".cookies",
    ".newsletter",
    ".modal",
    ".popup",
    ".sidebar",
    ".recommendations",
    ".related",
    ".ads",
    ".advertisement",
]

CONTENT_SELECTORS = [
    "article",
    "main",
    "[role='main']",
    ".content",
    ".article",
    ".post",
    ".page-content",
    "#content",
]


@dataclass(frozen=True)
class ExtractionResult:
    """Structured result of HTML cleaning and content extraction."""

    html: str
    method: str
    is_empty: bool


def parse_html(html: str, parser: str = "lxml") -> BeautifulSoup:
    """Parse HTML robustly with BeautifulSoup and parser fallback."""
    try:
        return BeautifulSoup(html, parser)
    except Exception:
        return BeautifulSoup(html, "html.parser")


def remove_boilerplate(soup: BeautifulSoup) -> BeautifulSoup:
    """Remove known non-content elements from a parsed document."""
    for selector in REMOVE_SELECTORS:
        for element in soup.select(selector):
            element.decompose()

    for comment in soup.find_all(string=lambda text: isinstance(text, str) and "<!--" in text):
        comment.extract()

    return soup


def _extract_with_trafilatura(html: str) -> str | None:
    """Extract main content with trafilatura when available."""
    try:
        import trafilatura
    except ImportError:
        return None

    extracted = trafilatura.extract(
        html,
        output_format="html",
        include_comments=False,
        include_tables=True,
        include_links=False,
        favor_precision=True,
    )
    return extracted.strip() if extracted else None


def _extract_with_selectolax(html: str) -> str | None:
    """Fallback extraction using selectolax when installed."""
    try:
        from selectolax.parser import HTMLParser
    except ImportError:
        return None

    tree = HTMLParser(html)
    for selector in CONTENT_SELECTORS:
        node = tree.css_first(selector)
        if node and node.text(strip=True):
            candidate = HTMLParser(node.html)
            for remove_selector in REMOVE_SELECTORS:
                for remove_node in candidate.css(remove_selector):
                    remove_node.decompose()
            body = candidate.body
            return body.html if body else candidate.html

    body = tree.body
    if body:
        candidate = HTMLParser(body.html)
        for selector in REMOVE_SELECTORS:
            for node in candidate.css(selector):
                node.decompose()
        body = candidate.body
        return body.html if body else candidate.html
    return body.html if body else None


def _extract_with_beautifulsoup(html: str) -> str:
    """Fallback extraction preserving semantic HTML tags."""
    for selector in CONTENT_SELECTORS:
        soup = parse_html(html)
        candidate = soup.select_one(selector)
        if candidate and len(candidate.get_text(" ", strip=True)) > 80:
            candidate_soup = remove_boilerplate(parse_html(str(candidate)))
            return str(candidate_soup)

    soup = remove_boilerplate(parse_html(html))
    body = soup.body or soup
    return str(body)


def extract_main_content(html: str) -> ExtractionResult:
    """Extract meaningful main content from a raw HTML page."""
    source = html or ""
    extracted = _extract_with_trafilatura(source)
    method = "trafilatura"

    if not extracted:
        extracted = _extract_with_selectolax(source)
        method = "selectolax" if extracted else "beautifulsoup"

    if not extracted:
        extracted = _extract_with_beautifulsoup(source)

    cleaned = _normalize_html(extracted)
    text = BeautifulSoup(cleaned, "html.parser").get_text(" ", strip=True)

    return ExtractionResult(html=cleaned, method=method, is_empty=len(text) < 40)


def _normalize_html(html: str) -> str:
    """Normalize whitespace while leaving semantic tags intact."""
    html = re.sub(r"\n{3,}", "\n\n", html)
    html = re.sub(r"[ \t]{2,}", " ", html)
    return html.strip()

