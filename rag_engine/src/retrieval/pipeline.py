"""Two-stage retrieval pipeline: vector search followed by reranking."""

from __future__ import annotations

import logging

from src.config.settings import (
    ENABLE_RERANKER,
    FINAL_TOP_K,
    MAX_SEARCH_DISTANCE,
    RERANKER_BACKEND,
    RERANKER_INIT_TIMEOUT_SECONDS,
    RERANKER_MODEL,
    RERANKER_USE_FP16,
    VECTOR_TOP_K,
)
from src.vectordb.chroma_store import SearchResult
from src.retrieval.retriever import Retriever, RetrieverConfig
from src.retrieval.reranker import RerankedResult, Reranker
from src.retrieval.validators import validate_ranking

logger = logging.getLogger(__name__)

class RetrievalPipeline:
    """Retrieval pipeline optimized for two-stage RAG execution."""

    def __init__(
        self,
        *,
        vector_top_k: int = VECTOR_TOP_K,
        final_top_k: int = FINAL_TOP_K,
        max_distance: float | None = MAX_SEARCH_DISTANCE,
        retriever: Retriever | None = None,
        reranker: Reranker | None = None,
    ) -> None:
        self.vector_top_k = vector_top_k
        self.final_top_k = final_top_k
        self.max_distance = max_distance
        self.retriever = retriever or Retriever(RetrieverConfig(top_k=vector_top_k, max_distance=max_distance))
        self.reranker = reranker or Reranker(
            model_name=RERANKER_MODEL,
            use_fp16=RERANKER_USE_FP16,
            init_timeout_seconds=RERANKER_INIT_TIMEOUT_SECONDS,
            backend=RERANKER_BACKEND,
        )
        self.last_reranker_status = "unknown"
        self.last_reranker_backend = "unknown"

    def retrieve(
        self,
        query: str,
        context_id: str = "",
        chatbot_id: str | None = None,
        namespace: str | None = None,
    ) -> tuple[list[SearchResult], list[RerankedResult]]:
        """Run query embedding, vector retrieval, reranking, and final truncation."""
        if not query.strip():
            raise ValueError("Query must be non-empty.")

        logger.info(
            "Retrieval start query=%r vector_top_k=%s final_top_k=%s reranker_enabled=%s reranker_backend=%s",
            query.strip(),
            self.vector_top_k,
            self.final_top_k,
            ENABLE_RERANKER,
            getattr(self.reranker, "backend", "unknown"),
        )
        vector_results = self.retriever.retrieve(
            query,
            context_id=context_id,
            chatbot_id=chatbot_id,
            namespace=namespace,
        )
        logger.info("Retrieved %s vector documents (top_k=%s)", len(vector_results), self.vector_top_k)
        for idx, result in enumerate(vector_results, start=1):
            logger.debug(
                "vector rank=%s chunk_id=%s distance=%s",
                idx,
                result.chunk_id,
                f"{result.distance:.4f}" if result.distance is not None else "n/a",
            )

        if not vector_results:
            logger.warning("No vector results returned for query=%r", query)
            self.last_reranker_status = "empty_retrieval"
            self.last_reranker_backend = "none"
            return [], []

        if not ENABLE_RERANKER:
            self.last_reranker_status = "disabled"
            self.last_reranker_backend = "disabled"
            reranked_results = self._vector_fallback_results(vector_results)
        else:
            try:
                reranked_results = self.reranker.rerank(query, vector_results)
                self.last_reranker_status = getattr(self.reranker, "last_status", "success")
                self.last_reranker_backend = getattr(self.reranker, "last_backend", "unknown")
            except Exception as exc:
                logger.exception(
                    "Reranker failure query=%r requested_backend=%s model=%s; using vector ranking fallback: %s",
                    query.strip(),
                    getattr(self.reranker, "backend", "unknown"),
                    getattr(self.reranker, "model_name", "unknown"),
                    exc,
                )
                self.last_reranker_status = "fallback"
                self.last_reranker_backend = getattr(self.reranker, "last_backend", "unknown")
                reranked_results = self._vector_fallback_results(vector_results)
        final_results = reranked_results[: self.final_top_k]
        logger.info("Final reranked document count=%s (top_k=%s)", len(final_results), self.final_top_k)
        logger.info(
            "Reranker status=%s backend=%s load_time_ms=%s execution_time_ms=%s",
            self.last_reranker_status,
            self.last_reranker_backend,
            f"{(getattr(self.reranker, 'last_load_seconds', 0.0) or 0.0) * 1000.0:.1f}",
            f"{(getattr(self.reranker, 'last_execution_seconds', 0.0) or 0.0) * 1000.0:.1f}"
            if getattr(self.reranker, "last_execution_seconds", None) is not None
            else "n/a",
        )
        logger.debug(
            "Final reranked docs=%s",
            [{"chunk_id": item.chunk_id, "rerank_score": item.rerank_score} for item in final_results],
        )
        if final_results and not validate_ranking([item.rerank_score for item in final_results]):
            raise RuntimeError("final reranked results are not sorted descending")
        for idx, result in enumerate(final_results, start=1):
            logger.debug(
                "reranked rank=%s chunk_id=%s vector_score=%s rerank_score=%.4f",
                idx,
                result.chunk_id,
                f"{result.score:.4f}" if result.score is not None else "n/a",
                result.rerank_score,
            )
        return vector_results, final_results

    def _vector_fallback_results(self, vector_results: list[SearchResult]) -> list[RerankedResult]:
        return [
            RerankedResult(
                chunk_id=item.chunk_id,
                text=item.content,
                score=None if item.distance is None else (1.0 / (1.0 + float(item.distance))),
                rerank_score=0.0,
                metadata=item.metadata,
            )
            for item in vector_results
        ]


def retrieve_with_rerank(
    query: str,
    *,
    vector_top_k: int = VECTOR_TOP_K,
    final_top_k: int = FINAL_TOP_K,
    context_id: str = "",
    chatbot_id: str | None = None,
    namespace: str | None = None,
) -> list[SearchResult]:
    """Compatibility adapter returning SearchResult list after reranking."""
    pipeline = RetrievalPipeline(vector_top_k=vector_top_k, final_top_k=final_top_k)
    _, reranked = pipeline.retrieve(
        query,
        context_id=context_id,
        chatbot_id=chatbot_id,
        namespace=namespace,
    )
    return [
        SearchResult(
            chunk_id=item.chunk_id,
            content=item.text,
            metadata=item.metadata,
            distance=None,
        )
        for item in reranked
    ]
