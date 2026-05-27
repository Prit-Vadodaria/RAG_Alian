"""Unit tests for the Google Gemini generation backend."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.llm.generation import GoogleGenerationBackend, GoogleGenerationConfig
from src.llm.google_client import GoogleClient, GoogleConfig


class GoogleGenerationTests(unittest.TestCase):
    def test_generate_posts_gemini_payload_and_returns_text(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Answer text"},
                        ]
                    }
                }
            ]
        }

        with patch("src.llm.google_client.requests.post", return_value=response) as mock_post:
            client = GoogleClient(
                GoogleConfig(
                    api_key="test-key",
                    model="gemini-3.1-flash-lite",
                    api_version="v1beta",
                    timeout_seconds=10,
                    temperature=0.2,
                    max_output_tokens=128,
                    max_retries=5,
                    retry_backoff=2,
                )
            )
            text = client.generate("Hello")

        self.assertEqual(text, "Answer text")
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn("generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent", args[0])
        self.assertEqual(kwargs["params"], {"key": "test-key"})
        self.assertEqual(kwargs["timeout"], 10)
        self.assertEqual(kwargs["json"]["generationConfig"]["temperature"], 0.2)
        self.assertEqual(kwargs["json"]["generationConfig"]["maxOutputTokens"], 128)
        self.assertEqual(kwargs["json"]["contents"][0]["parts"][0]["text"], "Hello")

    def test_generate_requires_api_key(self) -> None:
        client = GoogleClient(GoogleConfig(api_key=""))
        with self.assertRaises(RuntimeError):
            client.generate("Hello")

    def test_generate_retries_429_then_succeeds(self) -> None:
        rate_limit = Mock()
        rate_limit.status_code = 429
        rate_limit.raise_for_status.side_effect = requests.HTTPError("429 Too Many Requests", response=rate_limit)

        success = Mock()
        success.status_code = 200
        success.raise_for_status.return_value = None
        success.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Recovered answer"},
                        ]
                    }
                }
            ]
        }

        with (
            patch("src.llm.google_client.requests.post", side_effect=[rate_limit, success]) as mock_post,
            patch("src.llm.google_client.time.sleep") as mock_sleep,
        ):
            client = GoogleClient(
                GoogleConfig(
                    api_key="test-key",
                    model="gemini-3.1-flash-lite",
                    api_version="v1beta",
                    timeout_seconds=10,
                    temperature=0.2,
                    max_output_tokens=128,
                    max_retries=2,
                    retry_backoff=2,
                )
            )
            text = client.generate("Hello")

        self.assertEqual(text, "Recovered answer")
        self.assertEqual(mock_post.call_count, 2)
        mock_sleep.assert_called_once_with(2.0)

    def test_generate_returns_rate_limit_fallback_after_retries(self) -> None:
        rate_limit = Mock()
        rate_limit.status_code = 429
        rate_limit.raise_for_status.side_effect = requests.HTTPError("429 Too Many Requests", response=rate_limit)

        with (
            patch("src.llm.google_client.requests.post", return_value=rate_limit) as mock_post,
            patch("src.llm.google_client.time.sleep") as mock_sleep,
        ):
            client = GoogleClient(
                GoogleConfig(
                    api_key="test-key",
                    model="gemini-3.1-flash-lite",
                    api_version="v1beta",
                    timeout_seconds=10,
                    temperature=0.2,
                    max_output_tokens=128,
                    max_retries=2,
                    retry_backoff=2,
                )
            )
            with self.assertRaises(RuntimeError) as ctx:
                client.generate("Hello")

        self.assertEqual(str(ctx.exception), "LLM temporarily unavailable due to rate limits.")
        self.assertEqual(mock_post.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)

    def test_generation_backend_returns_fallback_message_on_rate_limits(self) -> None:
        backend = GoogleGenerationBackend(
            GoogleGenerationConfig(
                api_key="test-key",
                model="gemini-3.1-flash-lite",
                api_version="v1beta",
                timeout_seconds=10,
                temperature=0.2,
                max_output_tokens=128,
                max_retries=2,
                retry_backoff=2,
            )
        )
        backend.client.generate = Mock(side_effect=RuntimeError("LLM temporarily unavailable due to rate limits."))

        text = backend.generate("Hello")

        self.assertEqual(text, "LLM temporarily unavailable due to rate limits.")


if __name__ == "__main__":
    unittest.main()
