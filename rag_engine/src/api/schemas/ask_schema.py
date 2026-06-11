from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from src.api.guardrails import check_text
from src.config.settings import (
    ALLOW_INFERENCE,
    DEFAULT_FALLBACK_BEHAVIOR,
    DEFAULT_STYLE,
    DEFAULT_TONE,
    STRICT_GROUNDING,
    WEBSITE_IDENTITY_MODE,
)


class PromptSettingsSchema(BaseModel):
    role: str = Field(..., min_length=1, max_length=1000)
    tone: str = Field(default=DEFAULT_TONE, max_length=64)
    answer_style: str = Field(default=DEFAULT_STYLE, max_length=64)
    fallback_behavior: str = Field(default=DEFAULT_FALLBACK_BEHAVIOR, max_length=128)
    strict_grounding: bool = Field(default=STRICT_GROUNDING)
    allow_inference: bool = Field(default=ALLOW_INFERENCE)
    website_identity_mode: bool = Field(default=WEBSITE_IDENTITY_MODE)
    constraints: list[str] = Field(default_factory=list)

    @field_validator("role")
    @classmethod
    def role_safe(cls, v: str) -> str:
        check_text(v.strip(), field_name="role")
        return v.strip()

    @field_validator("tone", "answer_style", "fallback_behavior")
    @classmethod
    def text_fields_safe(cls, v: str, info) -> str:
        cleaned = v.strip()
        check_text(cleaned, field_name=info.field_name)
        return cleaned


class GenerationConfigSchema(BaseModel):
    google_api_key: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    timeout_seconds: int = Field(default=60, ge=10, le=300)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_output_tokens: int = Field(default=512, ge=64)
    max_retries: int = Field(default=5, ge=1)
    retry_backoff: float = Field(default=2.0, ge=0.5)


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
    generation_config: GenerationConfigSchema | None = None
