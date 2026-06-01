"""Vector search helpers for per-website and multi-context retrieval."""

from __future__ import annotations

from pathlib import Path

from src.config.settings import CHROMA_DIR, MAX_SEARCH_DISTANCE
from src.vectordb.chroma_store import SearchResult, search_index
from src.website_contexts.context_registry import (
    BLOCKED_RETRIEVAL_STATUSES,
    embeddings_dir_for,
    get_context,
    list_ready_website_contexts,
)


def _tag_results(results: list[SearchResult], website_id: str) -> list[SearchResult]:
    tagged: list[SearchResult] = []
    for item in results:
        metadata = dict(item.metadata or {})
        metadata["website_id"] = website_id
        tagged.append(
            SearchResult(
                chunk_id=item.chunk_id,
                content=item.content,
                metadata=metadata,
                distance=item.distance,
            )
        )
    return tagged


def search_website_index(
    query: str,
    context_id: str,
    *,
    top_k: int = 20,
    max_distance: float | None = MAX_SEARCH_DISTANCE,
) -> list[SearchResult]:
    entry = get_context(context_id)
    if entry is None or entry.get("status") in BLOCKED_RETRIEVAL_STATUSES:
        return []
    chroma_dir = embeddings_dir_for(entry)
    if not chroma_dir.exists():
        return []
    results = search_index(query, chroma_dir=Path(chroma_dir), top_k=top_k, max_distance=max_distance)
    return _tag_results(results, context_id)


def search_all_ready_contexts(
    query: str,
    *,
    include_default: bool = True,
    top_k: int = 20,
    max_distance: float | None = MAX_SEARCH_DISTANCE,
) -> list[SearchResult]:
    """Merge vector hits from the default index and every ready website context."""
    per_source_k = max(3, top_k // 4)
    merged: list[SearchResult] = []

    if include_default:
        default_hits = search_index(
            query,
            chroma_dir=Path(CHROMA_DIR),
            top_k=per_source_k,
            max_distance=max_distance,
        )
        merged.extend(_tag_results(default_hits, "alian_default"))

    for entry in list_ready_website_contexts():
        context_id = str(entry["id"])
        hits = search_website_index(
            query,
            context_id,
            top_k=per_source_k,
            max_distance=max_distance,
        )
        merged.extend(hits)

    merged.sort(key=lambda item: item.distance if item.distance is not None else 1e9)
    return merged[:top_k]
