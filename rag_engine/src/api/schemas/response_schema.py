from __future__ import annotations

from typing import List

from pydantic import BaseModel


class ConfidenceSchema(BaseModel):
    retrieval: float
    grounding: float
    rerank: float
    overall: float


class SourceSchema(BaseModel):
    source_id: str
    title: str
    url: str
    section: str
    chunk_id: str
    rerank_score: float
    text: str
    similarity: float | None


class MetricsSchema(BaseModel):
    total_latency_ms: float
    retrieval_latency_ms: float
    rerank_latency_ms: float
    generation_latency_ms: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    throughput_tokens_per_second: float


class AskResponseSchema(BaseModel):
    success: bool
    query: str
    answer: str
    citations: List[str]
    sources: List[SourceSchema]
    confidence: ConfidenceSchema
    latency_ms: float
    metrics: MetricsSchema


class HealthResponseSchema(BaseModel):
    status: str
    service: str
    version: str


class ErrorResponseSchema(BaseModel):
    success: bool
    error: str
