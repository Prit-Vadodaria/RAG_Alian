from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from src.api.guardrails import check_text


class PromptSettingsSchema(BaseModel):
    role: str = Field(..., min_length=1, max_length=1000)
    constraints: list[str] = Field(default_factory=list)

    @field_validator("role")
    @classmethod
    def role_safe(cls, v: str) -> str:
        check_text(v.strip(), field_name="role")
        return v.strip()

    @field_validator("constraints")
    @classmethod
    def constraints_safe(cls, items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for i, item in enumerate(items):
            if not isinstance(item, str):
                raise ValueError(f"constraints[{i}] must be a string.")
            if len(item) > 300:
                raise ValueError(
                    f"constraints[{i}] exceeds 300-character limit ({len(item)} chars)."
                )
            check_text(item.strip(), field_name=f"constraints[{i}]")
            cleaned.append(item.strip())
        return cleaned


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
