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
from src.llm.google_client import GoogleClient, GoogleConfig

logger = logging.getLogger(__name__)


class TextGenerationBackend(Protocol):
    """Minimal generation backend interface."""

    def generate(self, prompt: str) -> str:
        """Generate text for the provided prompt."""


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

    def generate(self, prompt: str) -> str:
        try:
            return self.client.generate(prompt)
        except RuntimeError as exc:
            if "rate limits" in str(exc).lower():
                logger.warning("LLM temporarily unavailable due to rate limits.")
                return "LLM temporarily unavailable due to rate limits."
            raise
