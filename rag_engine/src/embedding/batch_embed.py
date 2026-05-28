"""Batch embedding helper utilities."""

from __future__ import annotations

from typing import Iterable

from src.embedding.embedder import Embedder


def batch_embed_documents(embedder: Embedder, documents: Iterable[str], batch_size: int = 64) -> list[list[float]]:
    """Embed documents in chunks to limit memory spikes."""
    docs = list(documents)
    vectors: list[list[float]] = []
    for index in range(0, len(docs), max(1, batch_size)):
        vectors.extend(embedder.embed_documents(docs[index : index + batch_size]))
    return vectors
