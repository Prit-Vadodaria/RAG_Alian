"""Vector DB schema re-exports."""

from src.vectordb.chroma_store import ChunkRecord, SearchResult

__all__ = ["ChunkRecord", "SearchResult"]
