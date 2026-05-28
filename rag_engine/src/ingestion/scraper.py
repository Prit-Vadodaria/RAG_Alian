"""Markdown conversion for cleaned HTML."""

from __future__ import annotations

import re

from markdownify import markdownify as md


def html_to_markdown(html: str) -> str:
    """Convert semantic HTML into normalized markdown."""
    markdown = md(
        html,
        heading_style="ATX",
        bullets="-",
        strip=["script", "style"],
    )
    return normalize_markdown(markdown)


def normalize_markdown(markdown: str) -> str:
    """Normalize whitespace and remove empty markdown noise."""
    lines = [line.rstrip() for line in markdown.replace("\r\n", "\n").split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip() + "\n" if text.strip() else ""

