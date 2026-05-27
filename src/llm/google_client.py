"""Minimal Google Gemini API client for local RAG generation."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

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

logger = logging.getLogger(__name__)

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com"


@dataclass(frozen=True)
class GoogleConfig:
    """Runtime configuration for Google Gemini generation requests."""

    api_key: str = GOOGLE_API_KEY
    model: str = GOOGLE_MODEL
    api_version: str = GOOGLE_API_VERSION
    timeout_seconds: int = GOOGLE_TIMEOUT_SECONDS
    temperature: float = GOOGLE_TEMPERATURE
    max_output_tokens: int = GOOGLE_MAX_OUTPUT_TOKENS
    max_retries: int = GOOGLE_MAX_RETRIES
    retry_backoff: float = GOOGLE_RETRY_BACKOFF


class GoogleClient:
    """HTTP client for Gemini's generateContent endpoint."""

    def __init__(self, config: GoogleConfig | None = None) -> None:
        self.config = config or GoogleConfig()

    def generate(self, prompt: str) -> str:
        """Generate text from Gemini and return the final response text."""
        if not prompt.strip():
            raise ValueError("Prompt must be non-empty.")
        if not self.config.api_key.strip():
            raise RuntimeError("GOOGLE_API_KEY is required to use the Google Gemini backend.")

        url = f"{_GEMINI_API_BASE}/{self.config.api_version}/models/{self.config.model}:generateContent"
        params = {"key": self.config.api_key}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_output_tokens,
            },
        }

        last_exc: Exception | None = None
        attempts = max(1, int(self.config.max_retries))
        for attempt in range(1, attempts + 1):
            try:
                response = requests.post(url, params=params, json=payload, timeout=self.config.timeout_seconds)
                if response.status_code == 429:
                    raise requests.HTTPError("429 Too Many Requests", response=response)
                response.raise_for_status()
                data = response.json()
                break
            except requests.Timeout as exc:
                raise RuntimeError(f"Google Gemini request timed out after {self.config.timeout_seconds}s.") from exc
            except requests.HTTPError as exc:
                if _is_rate_limit_error(exc):
                    last_exc = exc
                    if attempt < attempts:
                        sleep_seconds = float(self.config.retry_backoff) * (2 ** (attempt - 1))
                        logger.warning(
                            "Google Gemini rate limited model=%s attempt=%s/%s retrying_in=%.1fs",
                            self.config.model,
                            attempt,
                            attempts,
                            sleep_seconds,
                        )
                        time.sleep(sleep_seconds)
                        continue
                    raise RuntimeError("LLM temporarily unavailable due to rate limits.") from exc
                raise RuntimeError(f"Google Gemini request failed: {exc}") from exc
            except requests.RequestException as exc:
                raise RuntimeError(f"Google Gemini request failed: {exc}") from exc
            except ValueError as exc:
                raise RuntimeError("Google Gemini returned invalid JSON.") from exc
        else:
            if last_exc is not None:
                raise RuntimeError("LLM temporarily unavailable due to rate limits.") from last_exc
            raise RuntimeError("Google Gemini request failed unexpectedly.")

        text = _extract_text(data)
        if not text:
            logger.warning("Google Gemini returned an empty response for model=%s", self.config.model)
        return text


def _extract_text(data: dict) -> str:
    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""

    first_candidate = candidates[0]
    if not isinstance(first_candidate, dict):
        return ""

    content = first_candidate.get("content")
    if not isinstance(content, dict):
        return ""

    parts = content.get("parts")
    if not isinstance(parts, list):
        return ""

    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict):
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
    return "\n".join(texts).strip()


def _is_rate_limit_error(exc: requests.HTTPError) -> bool:
    response = getattr(exc, "response", None)
    return bool(response is not None and getattr(response, "status_code", None) == 429)
