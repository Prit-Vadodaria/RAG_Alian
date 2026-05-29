"""Retriever abstraction for vector search stage."""

from __future__ import annotations

from dataclasses import dataclass

from src.config.settings import MAX_SEARCH_DISTANCE
from src.vectordb.chroma_store import SearchResult
from src.vectordb.retrieval import search_index
from src.website_contexts.website_retriever import search_website_index
from src.config.settings import CHROMA_DIR
from pathlib import Path


@dataclass(frozen=True)
class RetrieverConfig:
    """Config for base vector retrieval."""

    top_k: int = 20
    max_distance: float | None = MAX_SEARCH_DISTANCE


class Retriever:
    """Thin vector retriever with centralized configuration."""

    def __init__(self, config: RetrieverConfig | None = None) -> None:
        self.config = config or RetrieverConfig()

    def retrieve(self, query: str) -> list[SearchResult]:
        return self.retrieve(query, context_id="alian_default")

    def retrieve(self, query: str, context_id: str = "alian_default") -> list[SearchResult]:
        # If default context selected, use existing global CHROMA_DIR. Otherwise
        # route retrieval to the website-specific chroma DB located under
        # BASE_DIR/websites/{context_id}/chroma.
        if context_id is None or context_id == "alian_default":
            return search_index(
                query,
                chroma_dir=Path(CHROMA_DIR),
                top_k=self.config.top_k,
                max_distance=self.config.max_distance,
            )
        # Non-default context -> website chroma
        return search_website_index(query, context_id, top_k=self.config.top_k, max_distance=self.config.max_distance)
