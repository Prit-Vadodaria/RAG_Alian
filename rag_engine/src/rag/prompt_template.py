"""Backward-compatible prompt template wrapper."""

from __future__ import annotations

from src.rag.prompts import (
    ChatbotPromptConfig,
    DEFAULT_PROMPT_ROLE,
    DEFAULT_PROMPT_CONSTRAINTS,
    build_answer_prompt,
    build_graceful_fallback,
    build_grounded_prompt,
    build_recovery_prompt,
    classify_response_mode,
    normalize_prompt_config,
    normalize_prompt_settings,
    select_initial_response_mode,
    should_use_recovery,
)

DEFAULT_ROLE = DEFAULT_PROMPT_ROLE
MANDATORY_CONSTRAINT = "Answer only using information supported by the website knowledge."
DEFAULT_CONSTRAINTS = list(DEFAULT_PROMPT_CONSTRAINTS)

__all__ = [
    "ChatbotPromptConfig",
    "DEFAULT_CONSTRAINTS",
    "DEFAULT_ROLE",
    "MANDATORY_CONSTRAINT",
    "build_answer_prompt",
    "build_graceful_fallback",
    "build_grounded_prompt",
    "build_recovery_prompt",
    "classify_response_mode",
    "normalize_prompt_config",
    "normalize_prompt_settings",
    "select_initial_response_mode",
    "should_use_recovery",
]
