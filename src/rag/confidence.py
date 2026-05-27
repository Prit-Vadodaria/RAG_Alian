"""Deterministic confidence scoring helpers for RAG outputs."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Iterable, Sequence

from src.retrieval.reranker import RerankedResult
from src.vectordb.chroma_store import SearchResult

GENERIC_PHRASES = (
    "i don't know",
    "i do not know",
    "not enough information",
    "insufficient information",
    "cannot determine",
    "can't determine",
    "based on the provided context",
    "no relevant context",
    "not present in the context",
    "cannot answer",
)

LOWERCASE_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class ConfidenceBreakdown:
    """Structured confidence components."""

    retrieval: float
    rerank: float
    grounding: float
    answer_quality: float


def compute_retrieval_confidence(results: Sequence[SearchResult]) -> float:
    """Score retrieval quality from vector similarities."""

    similarities = [
        _similarity_from_distance(result.distance)
        for result in results
        if result.distance is not None
    ]

    if not similarities:
        return 0.0

    top_similarity = max(similarities)
    mean_similarity = sum(similarities) / len(similarities)

    score = 0.75 * top_similarity + 0.25 * mean_similarity

    return _clamp(score)


def compute_rerank_confidence(results: Sequence[RerankedResult]) -> float:
    """Score reranker certainty from the margin between the top two results."""
    if not results:
        return 0.0

    ordered = sorted(results, key=lambda item: item.rerank_score, reverse=True)
    top_score = ordered[0].rerank_score
    second_score = ordered[1].rerank_score if len(ordered) > 1 else 0.0
    return _sigmoid(top_score - second_score)


def compute_grounding_confidence(answer: str, context: str) -> float:
    """Score how much of the answer is supported by the retrieved context."""
    answer_tokens = _tokens(answer)
    if not answer_tokens:
        return 0.0

    context_tokens = set(_tokens(context))
    if not context_tokens:
        return 0.0

    supported = sum(1 for token in answer_tokens if token in context_tokens)
    return _clamp(supported / len(answer_tokens))


def compute_answer_quality_confidence(answer: str, context: str, grounding_confidence: float | None = None) -> float:
    """Heuristic answer-quality score that penalizes weak or generic outputs."""
    answer_text = answer.strip()
    if not answer_text:
        return 0.0

    quality = 1.0
    tokens = _tokens(answer_text)
    context_text = context.lower()
    context_tokens = set(_tokens(context))
    grounding = grounding_confidence if grounding_confidence is not None else compute_grounding_confidence(answer_text, context)

    if len(tokens) < 4:
        quality -= 0.35
    elif len(tokens) < 8:
        quality -= 0.15

    lowered = answer_text.lower()
    if any(phrase in lowered for phrase in GENERIC_PHRASES):
        quality -= 0.45

    answer_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", lowered)
    if answer_numbers:
        unsupported_numbers = [number for number in answer_numbers if number not in context_text and number not in context_tokens]
        quality -= min(0.4, 0.15 * len(unsupported_numbers))

    if grounding < 0.2:
        quality -= 0.3
    elif grounding < 0.5:
        quality -= 0.15

    if "i don't know" in lowered or "not enough information" in lowered:
        quality -= 0.15

    return _clamp(quality)


def compute_final_confidence(
    retrieval_confidence: float,
    rerank_confidence: float,
    grounding_confidence: float,
    answer_quality_confidence: float,
) -> float:
    """Combine the confidence components into a normalized final score."""
    retrieval = _clamp(retrieval_confidence)
    rerank = _clamp(rerank_confidence)
    grounding = _clamp(grounding_confidence)
    answer_quality = _clamp(answer_quality_confidence)
    score = 0.35 * retrieval + 0.30 * rerank + 0.20 * grounding + 0.15 * answer_quality
    return _clamp(score)


def confidence_label(score: float) -> str:
    """Map a normalized confidence score to a human-readable label."""
    if score >= 0.85:
        return "high"
    if score >= 0.65:
        return "medium"
    return "low"


def compute_confidence_breakdown(
    vector_results: Sequence[SearchResult],
    reranked_results: Sequence[RerankedResult],
    answer: str,
    context: str,
) -> tuple[float, ConfidenceBreakdown]:
    """Compute all confidence components and the final score in one pass."""
    retrieval = compute_retrieval_confidence(vector_results)
    rerank = compute_rerank_confidence(reranked_results)
    grounding = compute_grounding_confidence(answer, context)
    answer_quality = compute_answer_quality_confidence(answer, context, grounding)
    final = compute_final_confidence(retrieval, rerank, grounding, answer_quality)
    return final, ConfidenceBreakdown(
        retrieval=retrieval,
        rerank=rerank,
        grounding=grounding,
        answer_quality=answer_quality,
    )


def _similarity_from_distance(distance: float | None) -> float:
    if distance is None:
        return 0.0
    return 1.0 / (1.0 + float(distance))


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def _tokens(text: str) -> list[str]:
    return [token for token in LOWERCASE_TOKEN_PATTERN.findall(text.lower()) if token]


def _clamp(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return float(value)
