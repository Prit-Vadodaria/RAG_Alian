"""Validation helpers for retrieval and reranking diagnostics."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import is_dataclass
from typing import Any

from src.vectordb.chroma_store import SearchResult


def extract_doc_text(doc: Any) -> str:
    """Return text from common document shapes used across migration paths."""
    if isinstance(doc, SearchResult):
        return str(doc.content or "").strip()
    if isinstance(doc, dict):
        for key in ("text", "page_content", "content"):
            value = doc.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for attr in ("text", "page_content", "content"):
        value = getattr(doc, attr, None)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if is_dataclass(doc):
        for field_name in ("text", "page_content", "content"):
            value = getattr(doc, field_name, None)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""


def extract_doc_metadata(doc: Any) -> dict[str, Any]:
    if isinstance(doc, SearchResult):
        return dict(doc.metadata or {})
    if isinstance(doc, dict):
        metadata = doc.get("metadata")
        return dict(metadata or {}) if isinstance(metadata, dict) else {}
    metadata = getattr(doc, "metadata", None)
    return dict(metadata or {}) if isinstance(metadata, dict) else {}


def validate_docs(docs: Sequence[Any]) -> list[str]:
    """Validate retrieval docs and normalize text access."""
    if docs is None:
        raise ValueError("docs must not be None")

    texts = [extract_doc_text(doc) for doc in docs]
    if any(not text for text in texts):
        raise ValueError("one or more docs are missing text/page_content/content")
    return texts


def validate_pairs(query: str, docs: Sequence[Any]) -> list[tuple[str, str]]:
    """Validate query/doc pairs for reranking input."""
    if not query or not query.strip():
        raise ValueError("query must not be empty")
    texts = validate_docs(docs)
    pairs = [(query.strip(), text) for text in texts]
    if any(not left.strip() or not right.strip() for left, right in pairs):
        raise ValueError("invalid reranker pairs detected")
    return pairs


def validate_scores(scores: Sequence[float], docs: Sequence[Any]) -> list[float]:
    """Validate reranker output scores."""
    if not scores:
        raise ValueError("reranker returned no scores")
    if len(scores) != len(docs):
        raise ValueError("score/doc mismatch")
    return [float(score) for score in scores]


def validate_ranking(scores: Sequence[float]) -> bool:
    """Return True if scores are sorted descending."""
    if not scores:
        raise ValueError("cannot validate empty ranking")
    return all(scores[index] >= scores[index + 1] for index in range(len(scores) - 1))


def normalize_context(context: str, *, max_chars: int) -> str:
    """Trim oversized context safely for prompts."""
    text = (context or "").strip()
    if len(text) <= max_chars:
        return text
    return text[: max(0, max_chars)].rstrip()


def truncate_text_for_rerank(text: str, *, max_words: int = 256, max_chars: int = 2000) -> str:
    """Trim long chunks before reranking to avoid cross-encoder overflow."""
    compact = " ".join((text or "").split())
    if len(compact) > max_chars:
        compact = compact[:max_chars].rstrip()
    words = compact.split()
    if len(words) > max_words:
        compact = " ".join(words[:max_words]).rstrip()
    return compact
