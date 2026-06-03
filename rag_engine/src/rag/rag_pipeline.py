"""Integrated RAG pipeline: retrieve, rerank, build context, prompt, generate."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from src.config.settings import MAX_CONTEXT_TOKENS
from src.rag.confidence import confidence_label, compute_confidence_breakdown
from src.llm.generation import GoogleGenerationBackend, TextGenerationBackend
from src.rag.context_builder import ContextSource, build_context
from src.rag.prompt_template import build_grounded_prompt
from src.retrieval.pipeline import FINAL_TOP_K, VECTOR_TOP_K, RetrievalPipeline
from src.retrieval.reranker import RerankedResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RagMetrics:
    total_latency_ms: float
    retrieval_latency_ms: float
    rerank_latency_ms: float
    generation_latency_ms: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    throughput_tokens_per_second: float


@dataclass(frozen=True)
class RagResult:
    query: str
    answer: str
    confidence: float
    confidence_label: str
    confidence_breakdown: dict[str, float]
    vector_results_count: int
    reranker_status: str
    reranked_results: list[RerankedResult]
    context: str
    sources: list[ContextSource]
    metrics: RagMetrics


class RagPipeline:
    def __init__(
        self,
        *,
        vector_top_k: int = VECTOR_TOP_K,
        final_top_k: int = FINAL_TOP_K,
        max_context_tokens: int = MAX_CONTEXT_TOKENS,
        retrieval_pipeline: RetrievalPipeline | None = None,
        generation_backend: TextGenerationBackend | None = None,
    ) -> None:
        self.vector_top_k = vector_top_k
        self.final_top_k = final_top_k
        self.max_context_tokens = max_context_tokens
        self.retrieval_pipeline = retrieval_pipeline or RetrievalPipeline(
            vector_top_k=vector_top_k,
            final_top_k=final_top_k,
        )
        self.generation_backend = generation_backend or GoogleGenerationBackend()

    def run(
        self,
        query: str,
        context_id: str = "",
        chatbot_id: str | None = None,
        namespace: str | None = None,
        visitor_id: str | None = None,
        origin: str | None = None,
        prompt_settings: dict[str, object] | None = None,
    ) -> RagResult:
        pipeline_start = time.perf_counter()
        retrieval_start = time.perf_counter()

        vector_results, reranked = self.retrieval_pipeline.retrieve(
            query,
            context_id=context_id,
            chatbot_id=chatbot_id,
            namespace=namespace,
        )
        retrieval_latency_ms = (time.perf_counter() - retrieval_start) * 1000
        final_chunks = reranked[: self.final_top_k]

        context, sources = build_context(final_chunks, max_context_tokens=self.max_context_tokens)
        if final_chunks and not context:
            raise RuntimeError("Final context is empty after building from reranked chunks.")

        prompt = build_grounded_prompt(
            query,
            context,
            role=(prompt_settings or {}).get("role") if prompt_settings else None,
            additional_constraints=(prompt_settings or {}).get("constraints") if prompt_settings else None,
        )

        generation_start = time.perf_counter()
        generation_result = self.generation_backend.generate(prompt)
        answer = generation_result.text.strip()
        generation_latency_ms = (time.perf_counter() - generation_start) * 1000

        if not answer:
            answer = "I don't know based on the provided context."

        confidence, breakdown = compute_confidence_breakdown(vector_results, final_chunks, answer, context)

        total_latency_ms = (time.perf_counter() - pipeline_start) * 1000
        rerank_latency_ms = (
            getattr(self.retrieval_pipeline.reranker, "last_execution_seconds", 0.0) or 0.0
        ) * 1000

        input_tokens = generation_result.input_tokens
        output_tokens = generation_result.output_tokens
        total_tokens = generation_result.total_tokens
        throughput_tokens_per_second = output_tokens / max(generation_latency_ms / 1000.0, 0.001)

        metrics = RagMetrics(
            total_latency_ms=total_latency_ms,
            retrieval_latency_ms=retrieval_latency_ms,
            rerank_latency_ms=rerank_latency_ms,
            generation_latency_ms=generation_latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            throughput_tokens_per_second=throughput_tokens_per_second,
        )

        return RagResult(
            query=query,
            answer=answer,
            confidence=confidence,
            confidence_label=confidence_label(confidence),
            confidence_breakdown={
                "retrieval": breakdown.retrieval,
                "rerank": breakdown.rerank,
                "grounding": breakdown.grounding,
                "answer_quality": breakdown.answer_quality,
            },
            vector_results_count=len(vector_results),
            reranker_status=self.retrieval_pipeline.last_reranker_status,
            reranked_results=final_chunks,
            context=context,
            sources=sources,
            metrics=metrics,
        )
