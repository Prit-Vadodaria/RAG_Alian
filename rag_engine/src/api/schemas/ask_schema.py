from __future__ import annotations

from pydantic import BaseModel, Field


class PromptSettingsSchema(BaseModel):
    role: str = Field(..., min_length=1, max_length=1000)
    constraints: list[str] = Field(default_factory=list)


class AskRequestSchema(BaseModel):
    query: str = Field(..., min_length=1, example="What is RAG?")
    context_id: str = Field(
        "alian_default",
        description="Retrieval scope: 'alian_default', a website id, or 'all_ready' to search every ready context",
    )
    prompt_settings: PromptSettingsSchema | None = None
