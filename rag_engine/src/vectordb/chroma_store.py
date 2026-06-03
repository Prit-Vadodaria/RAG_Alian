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


def load_chunk_records(
    chunks_dir: Path = CHUNKS_DIR,
    metadata_overrides: dict[str, str | int | float | bool] | None = None,
    chunk_id_prefix: str = "",
) -> list[ChunkRecord]:
    records: list[ChunkRecord] = []
    for chunk_file in sorted(chunks_dir.glob("*.chunks.json")):
        chunks = json.loads(chunk_file.read_text(encoding="utf-8"))
        if not isinstance(chunks, list):
            continue
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            chunk_id = str(chunk.get("chunk_id", "")).strip()
            if chunk_id_prefix:
                chunk_id = f"{chunk_id_prefix}:{chunk_id}"
            content = str(chunk.get("content", "")).strip()
            if not chunk_id or not content:
                continue
            metadata = _metadata_for_chunk(chunk, chunk_file)
            if metadata_overrides:
                metadata.update({key: value for key, value in metadata_overrides.items() if value not in ("", None)})
            records.append(ChunkRecord(chunk_id=chunk_id, content=content, metadata=metadata))
    return records


def index_exported_chunks(
    *,
    chunks_dir: Path = CHUNKS_DIR,
    chroma_dir: Path = CHROMA_DIR,
    collection_name: str = CHROMA_COLLECTION,
    embedder: Embedder | None = None,
    batch_size: int = 64,
    metadata_overrides: dict[str, str | int | float | bool] | None = None,
    chunk_id_prefix: str = "",
) -> IndexSummary:
    records = load_chunk_records(
        chunks_dir,
        metadata_overrides=metadata_overrides,
        chunk_id_prefix=chunk_id_prefix,
    )
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

    def search(
        self,
        query: str,
        embedder: Embedder,
        *,
        top_k: int = 5,
        where: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        query_embedding = embedder.embed_query(query)
        query_kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            query_kwargs["where"] = where
        raw = self.collection.query(**query_kwargs)
        return _parse_query_results(raw)

    def delete_where(self, where: dict[str, Any]) -> None:
        try:
            self.collection.delete(where=where)
        except Exception:
            return


def search_index(
    query: str,
    *,
    chroma_dir: Path = CHROMA_DIR,
    collection_name: str = CHROMA_COLLECTION,
    embedder: Embedder | None = None,
    top_k: int = 5,
    max_distance: float | None = MAX_SEARCH_DISTANCE,
    where: dict[str, Any] | None = None,
) -> list[SearchResult]:
    store = ChromaStore(chroma_dir=chroma_dir, collection_name=collection_name)
    active_embedder = embedder or SentenceTransformerEmbedder(EMBEDDING_MODEL)
    results = _search_with_variants(store, query, active_embedder, top_k=top_k, where=where)
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
    for key in (
        "url",
        "title",
        "section",
        "source_section",
        "content_type",
        "parent_chunk_id",
        "split_index",
        "split_count",
        "source_file",
        "document_hash",
        "token_count",
        "chatbot_id",
        "namespace",
        "context_id",
        "tenant_id",
    ):
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


def _search_with_variants(
    store: ChromaStore,
    query: str,
    embedder: Embedder,
    *,
    top_k: int,
    where: dict[str, Any] | None = None,
) -> list[SearchResult]:
    variants = _query_variants(query)
    merged: dict[str, SearchResult] = {}

    for variant in variants:
        variant_results = store.search(variant, embedder, top_k=top_k, where=where)
        for result in variant_results:
            existing = merged.get(result.chunk_id)
            if existing is None:
                merged[result.chunk_id] = result
                continue
            current_distance = existing.distance if existing.distance is not None else 1e9
            next_distance = result.distance if result.distance is not None else 1e9
            if next_distance < current_distance:
                merged[result.chunk_id] = result

    return sorted(merged.values(), key=lambda item: item.distance if item.distance is not None else 1e9)[:top_k]


QUERY_STOPWORDS = {"a", "an", "are", "about", "based", "do", "does", "for", "from", "give", "is", "me", "of", "on", "tell", "the", "to", "what", "who"}


def _query_variants(query: str) -> list[str]:
    text = query.strip()
    if not text:
        return []

    variants = [text]
    for phrase in _extract_entity_phrases(text):
        normalized = phrase.strip()
        if not normalized:
            continue
        variants.append(f"Find information about {normalized}")
        variants.append(f"{normalized} profile")
        variants.append(f"{normalized} engineer profile")

    deduped: list[str] = []
    seen: set[str] = set()
    for variant in variants:
        normalized = variant.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _extract_entity_phrases(text: str) -> list[str]:
    proper_nouns = re.findall(r"\b[A-Z][\w-]*(?:\s+[A-Z][\w-]*)+\b", text)
    if proper_nouns:
        return proper_nouns[:2]

    terms = _meaningful_terms(text)
    if len(terms) >= 2:
        return [" ".join(terms[: min(4, len(terms))])]
    return []


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
