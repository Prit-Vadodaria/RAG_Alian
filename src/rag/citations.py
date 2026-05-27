"""Citation formatting and source-id helpers."""

from __future__ import annotations


def source_id_for_index(index: int) -> str:
    """Return source id using one-based index."""
    return f"S{index}"


def citation_tag(source_id: str) -> str:
    return f"[{source_id}]"
