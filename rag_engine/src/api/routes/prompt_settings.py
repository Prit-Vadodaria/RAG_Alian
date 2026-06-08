from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from src.api.guardrails import check_text
from src.api.services.prompt_settings_service import (
    get_default_settings,
    load_prompt_settings,
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
    constraints: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="Additional answer constraints (max 10 items, 300 chars each).",
    )

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
    return save_prompt_settings(request.role, request.constraints)


@router.post("/prompt-settings/reset")
async def reset_prompt_settings() -> dict[str, object]:
    defaults = get_default_settings()
    return save_prompt_settings(defaults["role"], defaults["constraints"])