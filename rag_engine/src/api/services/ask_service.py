from __future__ import annotations

import time
from typing import Any

from fastapi import HTTPException

from src.api.schemas.response_schema import (
    AskResponseSchema,
    ConfidenceSchema,
    MetricsSchema,
    SourceSchema,
)
from src.rag.rag_pipeline import RagPipeline


_pipeline = RagPipeline()


def _serialize_sources(sources: list[Any]) -> list[SourceSchema]:
    return [
        SourceSchema(
            source_id=source.source_id,
            title=source.title,
            url=source.url,
            section=source.section,
            chunk_id=source.chunk_id,
            rerank_score=source.rerank_score,
            text=source.text,
            similarity=source.similarity,
        )
        for source in sources
    ]


def ask_query(query: str, context_id: str = "alian_default") -> AskResponseSchema:
    stripped_query = query.strip() if isinstance(query, str) else ""
    if not stripped_query:
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    start_time = time.perf_counter()

    try:
        result = _pipeline.run(stripped_query, context_id=context_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unexpected RAG engine error while processing the query.",
        ) from exc

    latency_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

    confidence = ConfidenceSchema(
        retrieval=result.confidence_breakdown.get("retrieval", 0.0),
        grounding=result.confidence_breakdown.get("grounding", 0.0),
        rerank=result.confidence_breakdown.get("rerank", 0.0),
        overall=result.confidence,
    )

    sources = _serialize_sources(result.sources)
    citations = [source.source_id for source in sources]
    result_metrics = result.metrics
    metrics = MetricsSchema(
        total_latency_ms=round(result_metrics.total_latency_ms, 1),
        retrieval_latency_ms=round(result_metrics.retrieval_latency_ms, 1),
        rerank_latency_ms=round(result_metrics.rerank_latency_ms, 1),
        generation_latency_ms=round(result_metrics.generation_latency_ms, 1),
        input_tokens=result_metrics.input_tokens,
        output_tokens=result_metrics.output_tokens,
        total_tokens=result_metrics.total_tokens,
        throughput_tokens_per_second=round(
            result_metrics.throughput_tokens_per_second, 2
        ),
    )

    return AskResponseSchema(
        success=True,
        query=result.query,
        answer=result.answer,
        citations=citations,
        sources=sources,
        confidence=confidence,
        latency_ms=latency_ms,
        metrics=metrics,
    )
