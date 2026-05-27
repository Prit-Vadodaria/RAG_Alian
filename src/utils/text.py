"""Text utility helpers."""

from __future__ import annotations


def compact_whitespace(text: str) -> str:
    return " ".join(text.split())


def preview(text: str, size: int = 180) -> str:
    return compact_whitespace(text)[:size]
