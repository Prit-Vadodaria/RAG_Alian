from __future__ import annotations

import unittest

from src.rag.prompts import (
    ResponseMode,
    build_answer_prompt,
    build_graceful_fallback,
    normalize_prompt_config,
    select_initial_response_mode,
)


class PromptBuilderTests(unittest.TestCase):
    def test_select_initial_response_mode_without_context_falls_back(self) -> None:
        config = normalize_prompt_config()
        self.assertEqual(
            select_initial_response_mode(
                retrieval_confidence=0.0,
                rerank_confidence=0.0,
                context="",
                config=config,
            ),
            ResponseMode.FALLBACK,
        )

    def test_build_answer_prompt_includes_response_mode(self) -> None:
        prompt = build_answer_prompt(
            "What do you offer?",
            "We offer consulting and implementation services.",
            config=normalize_prompt_config(),
            response_mode=ResponseMode.PARTIAL,
        )

        self.assertIn("<response_mode>\npartial\n</response_mode>", prompt)
        self.assertIn("<voice>", prompt)

    def test_build_graceful_fallback_is_helpful(self) -> None:
        fallback = build_graceful_fallback("What do you offer?")
        self.assertIn("help", fallback.lower())


if __name__ == "__main__":
    unittest.main()
