"""Generation abstraction for Google Gemini-backed RAG."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from src.config.settings import (
    GOOGLE_API_KEY,
    GOOGLE_API_VERSION,
    GOOGLE_MAX_OUTPUT_TOKENS,
    GOOGLE_MAX_RETRIES,
    GOOGLE_MODEL,
    GOOGLE_RETRY_BACKOFF,
    GOOGLE_TEMPERATURE,
    GOOGLE_TIMEOUT_SECONDS,
)
from src.llm.google_client import GoogleClient, GoogleConfig, GoogleGenerationResult

logger = logging.getLogger(__name__)


class TextGenerationBackend(Protocol):
    """Minimal generation backend interface."""

    def generate(self, prompt: str):
        """Generate text for the provided prompt."""

    def generate_with_recovery(self, prompt: str, recovery_prompt: str | None = None):
        """Generate text and optionally retry with a recovery prompt."""


@dataclass(frozen=True)
class GoogleGenerationConfig:
    """Config for Google Gemini-backed generation."""

    model: str = GOOGLE_MODEL
    api_key: str = GOOGLE_API_KEY
    api_version: str = GOOGLE_API_VERSION
    timeout_seconds: int = GOOGLE_TIMEOUT_SECONDS
    temperature: float = GOOGLE_TEMPERATURE
    max_output_tokens: int = GOOGLE_MAX_OUTPUT_TOKENS
    max_retries: int = GOOGLE_MAX_RETRIES
    retry_backoff: float = GOOGLE_RETRY_BACKOFF


class GoogleGenerationBackend:
    """Adapter that exposes Google Gemini as a generic generation backend."""

    def __init__(self, config: GoogleGenerationConfig | None = None) -> None:
        active = config or GoogleGenerationConfig()
        logger.info("Active LLM Provider=%s", "Google Gemini")
        logger.info("Active LLM Model=%s", active.model)
        self.client = GoogleClient(
            GoogleConfig(
                api_key=active.api_key,
                model=active.model,
                api_version=active.api_version,
                timeout_seconds=active.timeout_seconds,
                temperature=active.temperature,
                max_output_tokens=active.max_output_tokens,
                max_retries=active.max_retries,
                retry_backoff=active.retry_backoff,
            )
        )

    def generate(self, prompt: str):
        try:
            return self.client.generate(prompt)
        except RuntimeError as exc:
            if "rate limits" in str(exc).lower():
                logger.warning("LLM temporarily unavailable due to rate limits.")
                return GoogleGenerationResult(
                    text="LLM temporarily unavailable due to rate limits.",
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=0,
                )
            raise

    def generate_with_recovery(self, prompt: str, recovery_prompt: str | None = None):
        primary = self.generate(prompt)
        if recovery_prompt and _should_recover(primary.text):
            recovery = self.generate(recovery_prompt)
            if _is_better_recovery(primary.text, recovery.text):
                return recovery
        return primary


def _should_recover(text: str) -> bool:
    lowered = text.strip().lower()
    if not lowered:
        return True
    return any(
        phrase in lowered
        for phrase in (
            "i don't know",
            "i do not know",
            "not enough information",
            "insufficient information",
            "cannot determine",
            "can't determine",
            "no relevant context",
            "not present in the context",
            "cannot answer",
        )
    )


def _is_better_recovery(primary_text: str, recovery_text: str) -> bool:
    primary = primary_text.strip()
    recovery = recovery_text.strip()
    if not recovery:
        return False
    if not primary:
        return True
    if _should_recover(primary) and not _should_recover(recovery):
        return True
    return len(recovery) > len(primary)
