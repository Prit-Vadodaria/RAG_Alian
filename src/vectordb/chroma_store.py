"""Persistent ChromaDB storage for retrieval-ready chunks."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.config.settings import CHROMA_COLLECTION, CHROMA_DIR, CHUNKS_DIR, EMBEDDING_MODEL, MAX_SEARCH_DISTANCE
from src.embedding.embedder import Embedder, SentenceTransformerEmbedder


@dataclass(frozen=True)
class ChunkRecord:
    chunk_id: str
    content: str
    metadata: dict[str, str | int | float | bool]


@dataclass(frozen=True)
class IndexSummary:
    loaded_chunks: int
    indexed_chunks: int
    collection_name: str
    chroma_dir: str


@dataclass(frozen=True)
class SearchResult:
    chunk_id: str
    content: str
    metadata: dict[str, Any]
    distance: float | None


def load_chunk_records(chunks_dir: Path = CHUNKS_DIR) -> list[ChunkRecord]:
    records: list[ChunkRecord] = []
    for chunk_file in sorted(chunks_dir.glob("*.chunks.json")):
        chunks = json.loads(chunk_file.read_text(encoding="utf-8"))
        if not isinstance(chunks, list):
            continue
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            chunk_id = str(chunk.get("chunk_id", "")).strip()
            content = str(chunk.get("content", "")).strip()
            if not chunk_id or not content:
                continue
            records.append(ChunkRecord(chunk_id=chunk_id, content=content, metadata=_metadata_for_chunk(chunk, chunk_file)))
    return records


def index_exported_chunks(
    *,
    chunks_dir: Path = CHUNKS_DIR,
    chroma_dir: Path = CHROMA_DIR,
    collection_name: str = CHROMA_COLLECTION,
    embedder: Embedder | None = None,
    batch_size: int = 64,
) -> IndexSummary:
    records = load_chunk_records(chunks_dir)
    store = ChromaStore(chroma_dir=chroma_dir, collection_name=collection_name)
    active_embedder = embedder or SentenceTransformerEmbedder(EMBEDDING_MODEL)
    indexed = store.upsert_chunks(records, active_embedder, batch_size=batch_size)
    return IndexSummary(len(records), indexed, collection_name, str(chroma_dir))


class ChromaStore:
    def __init__(self, *, chroma_dir: Path = CHROMA_DIR, collection_name: str = CHROMA_COLLECTION) -> None:
        self.chroma_dir = chroma_dir
        self.collection_name = collection_name
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            import chromadb

            self.chroma_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self.chroma_dir))
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(name=self.collection_name)
        return self._collection

    def upsert_chunks(self, records: list[ChunkRecord], embedder: Embedder, *, batch_size: int = 64) -> int:
        indexed = 0
        for batch in _batches(records, batch_size):
            documents = [record.content for record in batch]
            embeddings = embedder.embed_documents(documents)
            self.collection.upsert(
                ids=[record.chunk_id for record in batch],
                documents=documents,
                metadatas=[record.metadata for record in batch],
                embeddings=embeddings,
            )
            indexed += len(batch)
        return indexed

    def search(self, query: str, embedder: Embedder, *, top_k: int = 5) -> list[SearchResult]:
        query_embedding = embedder.embed_query(query)
        raw = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        return _parse_query_results(raw)


def search_index(
    query: str,
    *,
    chroma_dir: Path = CHROMA_DIR,
    collection_name: str = CHROMA_COLLECTION,
    embedder: Embedder | None = None,
    top_k: int = 5,
    max_distance: float | None = MAX_SEARCH_DISTANCE,
) -> list[SearchResult]:
    store = ChromaStore(chroma_dir=chroma_dir, collection_name=collection_name)
    active_embedder = embedder or SentenceTransformerEmbedder(EMBEDDING_MODEL)
    results = store.search(query, active_embedder, top_k=top_k)
    return filter_search_results(results, query=query, max_distance=max_distance)


def filter_search_results(
    results: list[SearchResult],
    *,
    query: str = "",
    max_distance: float | None = MAX_SEARCH_DISTANCE,
) -> list[SearchResult]:
    if max_distance is None:
        return results
    return [
        result
        for result in results
        if (result.distance is not None and result.distance <= max_distance) or _has_exact_query_phrase(query, result.content)
    ]


def _metadata_for_chunk(chunk: dict[str, Any], chunk_file: Path) -> dict[str, str | int | float | bool]:
    metadata: dict[str, str | int | float | bool] = {"chunk_file": str(chunk_file)}
    for key in ("url", "title", "section", "source_section", "content_type", "parent_chunk_id", "split_index", "split_count", "source_file", "document_hash", "token_count"):
        value = chunk.get(key)
        if isinstance(value, (str, int, float, bool)) and value != "":
            metadata[key] = value
    heading_path = chunk.get("heading_path")
    if isinstance(heading_path, list):
        metadata["heading_path"] = " > ".join(str(item) for item in heading_path if str(item).strip())
    return metadata


def _batches(records: list[ChunkRecord], batch_size: int) -> list[list[ChunkRecord]]:
    if batch_size <= 0:
        batch_size = 64
    return [records[index : index + batch_size] for index in range(0, len(records), batch_size)]


def _parse_query_results(raw: dict[str, Any]) -> list[SearchResult]:
    ids = raw.get("ids", [[]])[0]
    documents = raw.get("documents", [[]])[0]
    metadatas = raw.get("metadatas", [[]])[0]
    distances = raw.get("distances", [[]])[0]
    results: list[SearchResult] = []
    for index, chunk_id in enumerate(ids):
        results.append(
            SearchResult(
                chunk_id=str(chunk_id),
                content=str(documents[index]) if index < len(documents) else "",
                metadata=metadatas[index] if index < len(metadatas) and metadatas[index] else {},
                distance=distances[index] if index < len(distances) else None,
            )
        )
    return results


QUERY_STOPWORDS = {"a", "an", "are", "about", "based", "do", "does", "for", "from", "give", "is", "me", "of", "on", "tell", "the", "to", "what", "who"}


def _has_exact_query_phrase(query: str, content: str) -> bool:
    query_terms = _meaningful_terms(query)
    if len(query_terms) < 2:
        return False
    normalized_content = _normalize_text(content)
    adjacent_phrases = [f"{query_terms[index]} {query_terms[index + 1]}" for index in range(len(query_terms) - 1)]
    return any(phrase in normalized_content for phrase in adjacent_phrases)


def _meaningful_terms(text: str) -> list[str]:
    return [term for term in re.findall(r"[a-z0-9]+", text.lower()) if len(term) > 2 and term not in QUERY_STOPWORDS]


def _normalize_text(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))
