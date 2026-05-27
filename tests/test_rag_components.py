"""Tests for src RAG context/prompt components."""

from __future__ import annotations

import unittest

from src.rag.context_builder import build_context
from src.rag.prompt_template import build_grounded_prompt
from src.retrieval.reranker import RerankedResult


class RagComponentsTests(unittest.TestCase):
    def test_build_context_adds_source_ids_and_metadata(self) -> None:
        context, sources = build_context(
            [
                RerankedResult(
                    chunk_id="chunk-1",
                    text="Fixed-fee sprint details.",
                    score=0.82,
                    rerank_score=0.97,
                    metadata={
                        "title": "Pricing",
                        "url": "https://example.com/pricing",
                        "section": "Sprint",
                    },
                )
            ],
            max_context_tokens=200,
        )

        self.assertIn("[S1]", context)
        self.assertIn("Fixed-fee sprint details.", context)
        self.assertEqual(sources[0].url, "https://example.com/pricing")

    def test_grounded_prompt_includes_guardrails_and_question(self) -> None:
        prompt = build_grounded_prompt("What is pricing?", "[S1]\nContent")
        self.assertIn("Use only the provided context", prompt)
        self.assertIn("I don't know based on the provided context.", prompt)
        self.assertIn("Question: What is pricing?", prompt)


if __name__ == "__main__":
    unittest.main()
