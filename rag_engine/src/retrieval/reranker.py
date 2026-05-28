"""Reranking utilities for two-stage retrieval."""

from __future__ import annotations

import atexit
import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Any

from src.config import settings as _settings  # noqa: F401  # ensure cache/env defaults are applied
from src.retrieval.validators import (
    extract_doc_metadata,
    extract_doc_text,
    truncate_text_for_rerank,
    validate_pairs,
    validate_ranking,
    validate_scores,
)
from src.vectordb.chroma_store import SearchResult

logger = logging.getLogger(__name__)

DEFAULT_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
DEFAULT_RERANKER_TIMEOUT_SECONDS = 30
DEFAULT_RERANKER_MAX_WORDS = 256
DEFAULT_RERANKER_MAX_CHARS = 1800
DEFAULT_RERANKER_BACKEND = "auto"

QUERY_STOPWORDS = {
    "a",
    "an",
    "are",
    "about",
    "based",
    "do",
    "does",
    "for",
    "from",
    "give",
    "is",
    "me",
    "of",
    "on",
    "tell",
    "the",
    "to",
    "what",
    "who",
}


@dataclass(frozen=True)
class RerankedResult:
    """A search result augmented with a rerank score."""

    chunk_id: str
    text: str
    score: float | None
    rerank_score: float
    metadata: dict[str, Any]


class _CrossEncoderRuntime:
    """Long-lived CrossEncoder runtime loaded once at startup."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        logger.info(
            "Reranker init start backend=cross_encoder model=%s device=cpu",
            self.model_name,
        )
        started_at = time.perf_counter()
        from sentence_transformers import CrossEncoder

        self._model = self._load_model(CrossEncoder)
        self.load_seconds = time.perf_counter() - started_at
        logger.info(
            "Reranker init complete backend=cross_encoder model=%s load_time_ms=%.1f",
            self.model_name,
            self.load_seconds * 1000.0,
        )

    def _load_model(self, cross_encoder_cls: Any) -> Any:
        return cross_encoder_cls(self.model_name, device="cpu")

    def score(self, pairs: list[tuple[str, str]], timeout_seconds: int) -> tuple[list[float], float]:
        logger.info(
            "Reranker prediction start backend=cross_encoder model=%s pair_count=%s timeout_seconds=%s",
            self.model_name,
            len(pairs),
            timeout_seconds,
        )
        started_at = time.perf_counter()
        try:
            scores = self._model.predict(pairs, convert_to_numpy=True, show_progress_bar=False)
        except Exception as exc:
            logger.exception(
                "Reranker prediction failed backend=cross_encoder model=%s pair_count=%s: %s",
                self.model_name,
                len(pairs),
                exc,
            )
            raise

        execution_seconds = time.perf_counter() - started_at
        raw_scores = scores.tolist() if hasattr(scores, "tolist") else list(scores)
        score_list = [float(score) for score in raw_scores]
        logger.info(
            "Reranker prediction complete backend=cross_encoder model=%s execution_time_ms=%.1f score_min=%.4f score_max=%.4f",
            self.model_name,
            execution_seconds * 1000.0,
            min(score_list),
            max(score_list),
        )
        return score_list, execution_seconds


class _HeuristicRuntime:
    """Fast local reranker used when transformer backends are unavailable."""

    backend_name = "heuristic"

    def score(self, pairs: list[tuple[str, str]], timeout_seconds: int) -> tuple[list[float], float]:
        logger.info(
            "Reranker prediction start backend=heuristic pair_count=%s timeout_seconds=%s",
            len(pairs),
            timeout_seconds,
        )
        started_at = time.perf_counter()
        scores = [self._score_pair(query, text) for query, text in pairs]
        execution_seconds = time.perf_counter() - started_at
        logger.info(
            "Reranker prediction complete backend=heuristic execution_time_ms=%.1f score_min=%.4f score_max=%.4f",
            execution_seconds * 1000.0,
            min(scores),
            max(scores),
        )
        return scores, execution_seconds

    def _score_pair(self, query: str, text: str) -> float:
        query_terms = _meaningful_terms(query)
        text_terms = _meaningful_terms(text)
        if not query_terms or not text_terms:
            return 0.0

        query_set = set(query_terms)
        text_set = set(text_terms)
        overlap = query_set & text_set
        if not overlap:
            return 0.0

        coverage = len(overlap) / len(query_set)
        precision = len(overlap) / len(text_set)
        phrase_bonus = 0.0
        text_blob = " ".join(text_terms)
        for left, right in zip(query_terms, query_terms[1:], strict=False):
            if f"{left} {right}" in text_blob:
                phrase_bonus = 1.0
                break

        score = (0.7 * coverage) + (0.25 * precision) + (0.05 * phrase_bonus)
        return max(0.0, min(1.0, score))


class Reranker:
    """Reusable reranker wrapper with an automatic heuristic fallback."""

    _runtime_cache: dict[str, _CrossEncoderRuntime] = {}
    _runtime_cache_lock = threading.Lock()

    def __init__(
        self,
        model_name: str = DEFAULT_RERANKER_MODEL,
        use_fp16: bool = False,
        init_timeout_seconds: int = DEFAULT_RERANKER_TIMEOUT_SECONDS,
        backend: str = DEFAULT_RERANKER_BACKEND,
    ) -> None:
        self.model_name = model_name
        self.use_fp16 = use_fp16
        self.init_timeout_seconds = init_timeout_seconds
        self.backend = (backend or DEFAULT_RERANKER_BACKEND).strip().lower()
        self.last_status = "initializing"
        self.last_backend = "unknown"
        self.last_load_seconds: float | None = None
        self.last_execution_seconds: float | None = None
        self._startup_error: Exception | None = None
        logger.info(
            "Reranker configuration enabled=true requested_backend=%s model=%s init_timeout_seconds=%s use_fp16=%s",
            self.backend,
            self.model_name,
            self.init_timeout_seconds,
            self.use_fp16,
        )

        if self.backend in {"heuristic", "lexical", "fallback", "default"}:
            self._runtime = _HeuristicRuntime()
            self.last_backend = _HeuristicRuntime.backend_name
            self.last_load_seconds = 0.0
            self.last_status = "heuristic"
            logger.info(
                "Reranker backend selected=heuristic reason=explicit_backend model=%s",
                self.model_name,
            )
            return

        if self.backend not in {"auto", "cross_encoder", "cross-encoder", "sentence_transformers"}:
            raise ValueError(f"Unknown reranker backend: {self.backend}")

        try:
            self._runtime = self._get_runtime()
            self.last_status = "ready"
        except Exception as exc:
            logger.exception(
                "Reranker backend=cross_encoder unavailable, falling back to heuristic scorer model=%s requested_backend=%s",
                self.model_name,
                self.backend,
            )
            self._runtime = _HeuristicRuntime()
            self._startup_error = exc
            self.last_status = "startup_fallback"
            self.last_backend = _HeuristicRuntime.backend_name
            self.last_load_seconds = 0.0

    def _get_runtime(self) -> _CrossEncoderRuntime | _HeuristicRuntime:
        with self._runtime_cache_lock:
            runtime = self._runtime_cache.get(self.model_name)
            if runtime is None:
                runtime = _CrossEncoderRuntime(self.model_name)
                self._runtime_cache[self.model_name] = runtime
                atexit.register(self._close_runtime, self.model_name)
        self.last_load_seconds = runtime.load_seconds
        self.last_backend = "cross_encoder"
        return runtime

    def rerank(self, query: str, documents: list[SearchResult]) -> list[RerankedResult]:
        """Rerank vector-retrieved documents for a query."""
        if not query.strip():
            raise ValueError("Query must be non-empty for reranking.")
        if not documents:
            return []

        logger.info("Reranker input docs=%s query=%r", len(documents), query.strip())
        validate_pairs(query, documents)
        texts = [
            truncate_text_for_rerank(
                extract_doc_text(doc),
                max_words=DEFAULT_RERANKER_MAX_WORDS,
                max_chars=DEFAULT_RERANKER_MAX_CHARS,
            )
            for doc in documents
        ]
        pairs = [(query.strip(), text) for text in texts]
        logger.debug("Reranker input pairs=%s", pairs)

        try:
            logger.info(
                "Reranker execution start backend=%s model=%s doc_count=%s",
                self.last_backend,
                self.model_name,
                len(documents),
            )
            scores, execution_seconds = self._runtime.score(pairs, timeout_seconds=self.init_timeout_seconds)
            self.last_execution_seconds = execution_seconds
        except TimeoutError:
            self.last_status = "timeout"
            self.last_execution_seconds = None
            raise
        except Exception as exc:
            self.last_status = "prediction_failed"
            self.last_execution_seconds = None
            logger.exception(
                "Reranker execution failed backend=%s model=%s doc_count=%s: %s",
                self.last_backend,
                self.model_name,
                len(documents),
                exc,
            )
            raise

        if self._startup_error is not None:
            self.last_status = "startup_fallback"
        elif self.last_backend == "heuristic":
            self.last_status = "heuristic"
        else:
            self.last_status = "success"

        scores = validate_scores(scores, documents)
        logger.debug("Reranker score outputs=%s", scores)

        reranked: list[RerankedResult] = []
        for doc, score, text in zip(documents, scores, texts, strict=False):
            similarity_score = None if doc.distance is None else (1.0 / (1.0 + float(doc.distance)))
            reranked.append(
                RerankedResult(
                    chunk_id=doc.chunk_id,
                    text=text,
                    score=similarity_score,
                    rerank_score=float(score),
                    metadata=extract_doc_metadata(doc),
                )
            )

        reranked.sort(key=lambda item: item.rerank_score, reverse=True)
        if not validate_ranking([item.rerank_score for item in reranked]):
            raise RuntimeError("reranked results are not sorted descending")

        non_zero_scores = any(score != 0.0 for score in scores)
        logger.info(
            "Reranker status=%s model=%s backend=%s load_time_ms=%s execution_time_ms=%s non_zero_scores=%s doc_count=%s score_min=%.4f score_max=%.4f",
            self.last_status,
            self.model_name,
            self.last_backend,
            f"{(self.last_load_seconds or 0.0) * 1000.0:.1f}",
            f"{(self.last_execution_seconds or 0.0) * 1000.0:.1f}" if self.last_execution_seconds is not None else "n/a",
            non_zero_scores,
            len(reranked),
            min(scores),
            max(scores),
        )
        logger.debug(
            "Final reranked docs=%s",
            [{"chunk_id": item.chunk_id, "rerank_score": item.rerank_score} for item in reranked],
        )
        return reranked

    @classmethod
    def warmup(
        cls,
        *,
        model_name: str = DEFAULT_RERANKER_MODEL,
        use_fp16: bool = False,
        init_timeout_seconds: int = DEFAULT_RERANKER_TIMEOUT_SECONDS,
        backend: str = DEFAULT_RERANKER_BACKEND,
    ) -> "Reranker":
        """Preload and cache the reranker runtime before the first query."""
        logger.info(
            "Reranker warmup start backend=%s model=%s init_timeout_seconds=%s use_fp16=%s",
            backend,
            model_name,
            init_timeout_seconds,
            use_fp16,
        )
        reranker = cls(
            model_name=model_name,
            use_fp16=use_fp16,
            init_timeout_seconds=init_timeout_seconds,
            backend=backend,
        )
        logger.info(
            "Reranker warmup complete backend=%s model=%s status=%s load_time_ms=%s",
            reranker.last_backend,
            reranker.model_name,
            reranker.last_status,
            f"{(reranker.last_load_seconds or 0.0) * 1000.0:.1f}",
        )
        return reranker

    @classmethod
    def _close_runtime(cls, model_name: str) -> None:
        cls._runtime_cache.pop(model_name, None)


def _meaningful_terms(text: str) -> list[str]:
    return [
        term
        for term in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(term) > 2 and term not in QUERY_STOPWORDS
    ]
