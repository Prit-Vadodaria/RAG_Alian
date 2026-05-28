"""Vector retrieval facade."""

from src.vectordb.chroma_store import filter_search_results, search_index

__all__ = ["search_index", "filter_search_results"]
