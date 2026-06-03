from __future__ import annotations

from pydantic import BaseModel, Field


class PromptSettingsSchema(BaseModel):
    role: str = Field(..., min_length=1, max_length=1000)
    constraints: list[str] = Field(default_factory=list)


class AskRequestSchema(BaseModel):
    query: str = Field(..., min_length=1, example="What is RAG?")
    context_id: str = Field(
        "",
        description="Retrieval scope: a website context id, or 'all_ready' to search every ready website context.",
    )
    chatbot_id: str | None = Field(
        default=None,
        description="Optional public chatbot identifier for multi-tenant scoping.",
    )
    namespace: str | None = Field(
        default=None,
        description="Optional retrieval namespace used for chatbot isolation.",
    )
    visitor_id: str | None = Field(
        default=None,
        description="Optional visitor identifier for public widget analytics.",
    )
    origin: str | None = Field(
        default=None,
        description="Optional request origin for domain validation and tracing.",
    )
    prompt_settings: PromptSettingsSchema | None = None
