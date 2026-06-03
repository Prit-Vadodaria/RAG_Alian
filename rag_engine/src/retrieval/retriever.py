"""Retriever abstraction for vector search stage."""

from __future__ import annotations

from dataclasses import dataclass

from src.config.settings import MAX_SEARCH_DISTANCE
from src.vectordb.chroma_store import SearchResult
from src.website_contexts.context_registry import BLOCKED_RETRIEVAL_STATUSES, get_context
from src.website_contexts.website_retriever import search_all_ready_contexts, search_website_index


@dataclass(frozen=True)
class RetrieverConfig:
    """Config for base vector retrieval."""

    top_k: int = 20
    max_distance: float | None = MAX_SEARCH_DISTANCE


class Retriever:
    """Thin vector retriever with centralized configuration."""

    def __init__(self, config: RetrieverConfig | None = None) -> None:
        self.config = config or RetrieverConfig()

    def retrieve(
        self,
        query: str,
        context_id: str = "",
        chatbot_id: str | None = None,
        namespace: str | None = None,
    ) -> list[SearchResult]:
        results = self._retrieve_by_context(query, context_id=context_id)
        return results

    def _retrieve_by_context(self, query: str, context_id: str = "") -> list[SearchResult]:
        if context_id == "all_ready":
            return search_all_ready_contexts(
                query,
                top_k=self.config.top_k,
                max_distance=self.config.max_distance,
            )

        if context_id in (None, ""):
            return []

        entry = get_context(context_id)
        if entry is None or entry.get("status") in BLOCKED_RETRIEVAL_STATUSES:
            return []

        return search_website_index(
            query,
            context_id,
            top_k=self.config.top_k,
            max_distance=self.config.max_distance,
        )
