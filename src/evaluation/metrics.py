"""Evaluation metric helpers."""

from __future__ import annotations


def recall_at_k(hits: int, total: int) -> float:
    """Compute recall@k safely."""
    if total <= 0:
        return 0.0
    return hits / total
