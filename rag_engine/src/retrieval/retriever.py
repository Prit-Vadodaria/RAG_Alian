"""Retriever abstraction for vector search stage."""

from __future__ import annotations

from dataclasses import dataclass

from src.config.settings import MAX_SEARCH_DISTANCE
from src.vectordb.chroma_store import SearchResult
from src.vectordb.retrieval import search_index


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
        return search_index(
            query,
            top_k=self.config.top_k,
            max_distance=self.config.max_distance,
        )
