from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.services.prompt_settings_service import (
    get_default_settings,
    load_prompt_settings,
    save_prompt_settings,
)


class PromptSettingsRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=1000)
    constraints: list[str] = Field(default_factory=list)


router = APIRouter()


@router.get("/prompt-settings")
async def get_prompt_settings() -> dict[str, object]:
    return load_prompt_settings()


@router.put("/prompt-settings")
async def update_prompt_settings(request: PromptSettingsRequest) -> dict[str, object]:
    return save_prompt_settings(request.role, request.constraints)


@router.post("/prompt-settings/reset")
async def reset_prompt_settings() -> dict[str, object]:
    defaults = get_default_settings()
    return save_prompt_settings(defaults["role"], defaults["constraints"])
