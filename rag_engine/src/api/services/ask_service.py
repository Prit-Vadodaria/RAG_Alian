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
from src.retrieval.pipeline import RetrievalPipeline
from src.llm.generation import GoogleGenerationBackend, GoogleGenerationConfig
from src.config.settings import (
    GOOGLE_API_KEY,
    GOOGLE_API_VERSION,
    GOOGLE_MAX_OUTPUT_TOKENS,
    GOOGLE_MAX_RETRIES,
    GOOGLE_MODEL,
    GOOGLE_RETRY_BACKOFF,
    GOOGLE_TEMPERATURE,
    GOOGLE_TIMEOUT_SECONDS,
)


_shared_retrieval_pipeline = RetrievalPipeline()


def _number_or_default(value: object, default: int | float) -> int | float:
    if value is None or value == "":
        return default
    try:
        return type(default)(value)
    except (TypeError, ValueError):
        return default


def _build_generation_backend(gen_config: dict[str, object] | None):
    if not gen_config:
        return GoogleGenerationBackend(
            GoogleGenerationConfig(
                api_key=GOOGLE_API_KEY,
                model=GOOGLE_MODEL,
                api_version=GOOGLE_API_VERSION,
                timeout_seconds=GOOGLE_TIMEOUT_SECONDS,
                temperature=GOOGLE_TEMPERATURE,
                max_output_tokens=GOOGLE_MAX_OUTPUT_TOKENS,
                max_retries=GOOGLE_MAX_RETRIES,
                retry_backoff=GOOGLE_RETRY_BACKOFF,
            )
        )

    api_key = str(gen_config.get("google_api_key") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=403,
            detail="Generation configuration is required. Configure your Google API key in account settings.",
        )

    return GoogleGenerationBackend(
        GoogleGenerationConfig(
            api_key=api_key,
            model=str(gen_config.get("model") or GOOGLE_MODEL),
            api_version=GOOGLE_API_VERSION,
            timeout_seconds=int(_number_or_default(gen_config.get("timeout_seconds"), GOOGLE_TIMEOUT_SECONDS)),
            temperature=float(_number_or_default(gen_config.get("temperature"), GOOGLE_TEMPERATURE)),
            max_output_tokens=int(_number_or_default(gen_config.get("max_output_tokens"), GOOGLE_MAX_OUTPUT_TOKENS)),
            max_retries=int(_number_or_default(gen_config.get("max_retries"), GOOGLE_MAX_RETRIES)),
            retry_backoff=float(_number_or_default(gen_config.get("retry_backoff"), GOOGLE_RETRY_BACKOFF)),
        )
    )


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


def ask_query(
    query: str,
    context_id: str = "",
    chatbot_id: str | None = None,
    namespace: str | None = None,
    visitor_id: str | None = None,
    origin: str | None = None,
    prompt_settings: dict[str, object] | None = None,
    generation_config: dict[str, object] | None = None,
) -> AskResponseSchema:
    stripped_query = query.strip() if isinstance(query, str) else ""
    if not stripped_query:
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    start_time = time.perf_counter()

    try:
        backend = _build_generation_backend(generation_config)
        pipeline = RagPipeline(
            retrieval_pipeline=_shared_retrieval_pipeline,
            generation_backend=backend,
        )
        result = pipeline.run(
            stripped_query,
            context_id=context_id,
            chatbot_id=chatbot_id,
            namespace=namespace,
            visitor_id=visitor_id,
            origin=origin,
            prompt_settings=prompt_settings,
        )
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
