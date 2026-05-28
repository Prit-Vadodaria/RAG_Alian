"""Lightweight local embedding benchmark for candidate retrieval models."""

from __future__ import annotations

import json
import time
import tracemalloc
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from src.config.settings import CHUNKS_DIR
from src.embedding.embedder import EMBEDDING_MODEL_CANDIDATES, SentenceTransformerEmbedder
from src.vectordb.chroma_store import load_chunk_records


@dataclass(frozen=True)
class BenchmarkQuery:
    """One retrieval benchmark query with optional expected URL/title terms."""

    query: str
    expected_terms: list[str]


@dataclass(frozen=True)
class ModelBenchmarkResult:
    """Summary for one embedding model benchmark run."""

    model: str
    status: str
    documents: int
    queries: int
    dimensions: int
    document_seconds: float
    query_seconds: float
    peak_memory_mb: float
    recall_at_5: float | None = None
    error: str | None = None


DEFAULT_QUERIES = [
    BenchmarkQuery("What are the fixed fee sprint pricing details?", ["pricing", "sprint"]),
    BenchmarkQuery("What legal templates are available?", ["legal", "template"]),
    BenchmarkQuery("How does Alian AI handle compliance evidence?", ["compliance", "evidence"]),
    BenchmarkQuery("What integrations are available for Slack?", ["slack", "integration"]),
    BenchmarkQuery("What is the RAG playbook about?", ["rag", "playbook"]),
]


def run_embedding_benchmark(
    *,
    chunks_dir: Path = CHUNKS_DIR,
    models: list[str] | None = None,
    query_file: Path | None = None,
    sample_size: int = 250,
    top_k: int = 5,
) -> list[ModelBenchmarkResult]:
    """Compare candidate embedding models on local chunk retrieval."""
    records = load_chunk_records(chunks_dir)[:sample_size]
    documents = [record.content for record in records]
    metadatas = [record.metadata for record in records]
    queries = load_benchmark_queries(query_file) if query_file else DEFAULT_QUERIES
    selected_models = models or list(EMBEDDING_MODEL_CANDIDATES)
    results: list[ModelBenchmarkResult] = []

    for model_name in selected_models:
        try:
            tracemalloc.start()
            embedder = SentenceTransformerEmbedder(model_name)

            start = time.perf_counter()
            document_embeddings = np.array(embedder.embed_documents(documents), dtype=np.float32)
            document_seconds = time.perf_counter() - start

            start = time.perf_counter()
            query_embeddings = np.array(
                [embedder.embed_query(benchmark_query.query) for benchmark_query in queries],
                dtype=np.float32,
            )
            query_seconds = time.perf_counter() - start
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            recall = _recall_at_k(document_embeddings, query_embeddings, documents, metadatas, queries, top_k)
            results.append(
                ModelBenchmarkResult(
                    model=model_name,
                    status="ok",
                    documents=len(documents),
                    queries=len(queries),
                    dimensions=int(document_embeddings.shape[1]) if document_embeddings.size else 0,
                    document_seconds=round(document_seconds, 4),
                    query_seconds=round(query_seconds, 4),
                    peak_memory_mb=round(peak / (1024 * 1024), 2),
                    recall_at_5=recall,
                )
            )
        except Exception as exc:
            if tracemalloc.is_tracing():
                tracemalloc.stop()
            results.append(
                ModelBenchmarkResult(
                    model=model_name,
                    status="failed",
                    documents=len(documents),
                    queries=len(queries),
                    dimensions=0,
                    document_seconds=0.0,
                    query_seconds=0.0,
                    peak_memory_mb=0.0,
                    error=str(exc),
                )
            )

    return results


def load_benchmark_queries(query_file: Path) -> list[BenchmarkQuery]:
    """Load query specs from JSON."""
    raw = json.loads(query_file.read_text(encoding="utf-8"))
    queries: list[BenchmarkQuery] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        query = str(item.get("query", "")).strip()
        expected_terms = [str(term).lower() for term in item.get("expected_terms", []) if str(term).strip()]
        if query and expected_terms:
            queries.append(BenchmarkQuery(query=query, expected_terms=expected_terms))
    return queries


def benchmark_results_to_json(results: list[ModelBenchmarkResult]) -> str:
    """Serialize benchmark results for CLI output or artifact storage."""
    return json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2)


def _recall_at_k(
    document_embeddings: np.ndarray,
    query_embeddings: np.ndarray,
    documents: list[str],
    metadatas: list[dict[str, str | int | float | bool]],
    queries: list[BenchmarkQuery],
    top_k: int,
) -> float | None:
    if not len(document_embeddings) or not len(query_embeddings) or not queries:
        return None

    hits = 0
    for query_index, benchmark_query in enumerate(queries):
        scores = document_embeddings @ query_embeddings[query_index]
        top_indexes = np.argsort(scores)[::-1][:top_k]
        haystack = " ".join(
            f"{documents[index].lower()} "
            + " ".join(str(value).lower() for value in metadatas[index].values())
            for index in top_indexes
        )
        if all(term in haystack for term in benchmark_query.expected_terms):
            hits += 1

    return round(hits / len(queries), 4)

