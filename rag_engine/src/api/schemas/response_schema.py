from __future__ import annotations

from typing import List

from pydantic import BaseModel


class ConfidenceSchema(BaseModel):
    retrieval: float
    grounding: float
    overall: float


class SourceSchema(BaseModel):
    source_id: str
    title: str
    url: str
    section: str
    chunk_id: str
    rerank_score: float


class AskResponseSchema(BaseModel):
    success: bool
    query: str
    answer: str
    citations: List[str]
    sources: List[SourceSchema]
    confidence: ConfidenceSchema
    latency_ms: float


class HealthResponseSchema(BaseModel):
    status: str
    service: str
    version: str


class ErrorResponseSchema(BaseModel):
    success: bool
    error: str
