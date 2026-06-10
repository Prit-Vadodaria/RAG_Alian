from __future__ import annotations

from fastapi import APIRouter, HTTPException
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
from src.api.services.prompt_settings_service import (
    load_prompt_settings,
    reset_prompt_settings as reset_prompt_settings_service,
    save_prompt_settings,
)

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class PromptSettingsRequest(BaseModel):
    role: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="System role description for the RAG assistant.",
    )
    tone: str = Field(default=DEFAULT_TONE, max_length=64)
    answer_style: str = Field(default=DEFAULT_STYLE, max_length=64)
    fallback_behavior: str = Field(default=DEFAULT_FALLBACK_BEHAVIOR, max_length=128)
    strict_grounding: bool = Field(default=STRICT_GROUNDING)
    allow_inference: bool = Field(default=ALLOW_INFERENCE)
    website_identity_mode: bool = Field(default=WEBSITE_IDENTITY_MODE)
    constraints: list[str] = Field(
        default_factory=list,
        description="Additional answer constraints (one per line, 300 chars each).",
    )

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

    @field_validator("constraints")
    @classmethod
    def constraints_safe(cls, items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for i, item in enumerate(items):
            if not isinstance(item, str):
                raise ValueError(f"constraints[{i}] must be a string.")
            if len(item) > 300:
                raise ValueError(
                    f"constraints[{i}] exceeds 300-character limit "
                    f"({len(item)} chars)."
                )
            check_text(item.strip(), field_name=f"constraints[{i}]")
            cleaned.append(item.strip())
        return cleaned


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/prompt-settings")
async def get_prompt_settings() -> dict[str, object]:
    return load_prompt_settings()


@router.put("/prompt-settings")
async def update_prompt_settings(
    request: PromptSettingsRequest,
) -> dict[str, object]:
    # Pydantic validators run before this point; request is already clean.
    try:
        return save_prompt_settings(
            request.role,
            request.constraints,
            tone=request.tone,
            answer_style=request.answer_style,
            fallback_behavior=request.fallback_behavior,
            strict_grounding=request.strict_grounding,
            allow_inference=request.allow_inference,
            website_identity_mode=request.website_identity_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/prompt-settings/reset")
async def reset_prompt_settings() -> dict[str, object]:
    try:
        return reset_prompt_settings_service()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
