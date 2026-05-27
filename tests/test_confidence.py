"""Tests for deterministic RAG confidence scoring."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.rag.confidence import (
    confidence_label,
    compute_answer_quality_confidence,
    compute_final_confidence,
    compute_grounding_confidence,
    compute_rerank_confidence,
    compute_retrieval_confidence,
)
from src.rag.rag_pipeline import RagPipeline
from src.retrieval.reranker import RerankedResult
from src.vectordb.chroma_store import SearchResult


class FakeRetriever:
    def __init__(self, docs: list[SearchResult]) -> None:
        self.docs = docs

    def retrieve(self, query: str) -> list[SearchResult]:
        return self.docs


class FakeReranker:
    def __init__(self, scores: list[float]) -> None:
        self.scores = scores

    def rerank(self, query: str, documents: list[SearchResult]) -> list[RerankedResult]:
        reranked = [
            RerankedResult(
                chunk_id=doc.chunk_id,
                text=doc.content,
                score=None if doc.distance is None else (1.0 / (1.0 + float(doc.distance))),
                rerank_score=float(score),
                metadata=doc.metadata,
            )
            for doc, score in zip(documents, self.scores, strict=False)
        ]
        reranked.sort(key=lambda item: item.rerank_score, reverse=True)
        return reranked


class FakeGenerationBackend:
    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.prompts: list[str] = []

    def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self.answer


class ConfidenceScoringTests(unittest.TestCase):
    def test_strong_retrieval_produces_higher_confidence_than_weak_retrieval(self) -> None:
        strong_results = [
            SearchResult("a", "content", {}, 0.01),
            SearchResult("b", "content", {}, 0.02),
            SearchResult("c", "content", {}, 0.03),
        ]
        weak_results = [
            SearchResult("a", "content", {}, 2.0),
            SearchResult("b", "content", {}, 2.5),
            SearchResult("c", "content", {}, 3.0),
        ]

        strong = compute_retrieval_confidence(strong_results)
        weak = compute_retrieval_confidence(weak_results)

        self.assertGreater(strong, weak)
        self.assertGreaterEqual(strong, 0.0)
        self.assertLessEqual(strong, 1.0)
        self.assertGreaterEqual(weak, 0.0)
        self.assertLessEqual(weak, 1.0)

    def test_rerank_confidence_uses_score_gap(self) -> None:
        confident = compute_rerank_confidence(
            [
                RerankedResult("a", "x", 0.1, 8.0, {}),
                RerankedResult("b", "y", 0.1, 0.0, {}),
            ]
        )
        conflicted = compute_rerank_confidence(
            [
                RerankedResult("a", "x", 0.1, 0.61, {}),
                RerankedResult("b", "y", 0.1, 0.60, {}),
            ]
        )

        self.assertGreater(confident, conflicted)
        self.assertGreaterEqual(confident, 0.0)
        self.assertLessEqual(confident, 1.0)
        self.assertGreaterEqual(conflicted, 0.0)
        self.assertLessEqual(conflicted, 1.0)

    def test_grounding_penalizes_hallucinated_answers(self) -> None:
        context = "The plan costs 100 dollars per month."
        grounded_answer = "The plan costs 100 dollars per month."
        hallucinated_answer = "The plan costs 999 dollars and includes 12 seats."

        grounded = compute_grounding_confidence(grounded_answer, context)
        hallucinated = compute_grounding_confidence(hallucinated_answer, context)

        self.assertGreater(grounded, hallucinated)
        self.assertGreaterEqual(grounded, 0.0)
        self.assertLessEqual(grounded, 1.0)
        self.assertGreaterEqual(hallucinated, 0.0)
        self.assertLessEqual(hallucinated, 1.0)

    def test_answer_quality_penalizes_generic_and_empty_answers(self) -> None:
        context = "The plan costs 100 dollars per month."
        concrete = compute_answer_quality_confidence("The plan costs 100 dollars per month.", context, 1.0)
        generic = compute_answer_quality_confidence("I don't know based on the provided context.", context, 0.0)
        empty = compute_answer_quality_confidence("", context, 0.0)

        self.assertGreater(concrete, generic)
        self.assertGreater(generic, empty)
        self.assertGreaterEqual(concrete, 0.0)
        self.assertLessEqual(concrete, 1.0)
        self.assertGreaterEqual(generic, 0.0)
        self.assertLessEqual(generic, 1.0)
        self.assertEqual(empty, 0.0)

    def test_final_confidence_is_normalized(self) -> None:
        score = compute_final_confidence(0.91, 0.84, 0.8, 0.88)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)
        self.assertEqual(confidence_label(score), "high")

    def test_pipeline_returns_structured_confidence_payload_and_preserves_answer(self) -> None:
        docs = [
            SearchResult("1", "The plan costs 100 dollars per month.", {"title": "Pricing", "url": "https://example.com", "section": "Pricing"}, 0.01),
            SearchResult("2", "Support is included.", {"title": "Support", "url": "https://example.com/support", "section": "Support"}, 0.03),
        ]
        retrieval_pipeline = type(
            "RetrievalPipelineStub",
            (),
            {
                "last_reranker_status": "success",
                "retrieve": lambda self, query: (docs, [
                    RerankedResult("1", docs[0].content, 0.99, 8.0, docs[0].metadata),
                    RerankedResult("2", docs[1].content, 0.97, 0.0, docs[1].metadata),
                ]),
            },
        )()
        backend = FakeGenerationBackend("The plan costs 100 dollars per month. [S1]")
        rag = RagPipeline(retrieval_pipeline=retrieval_pipeline, generation_backend=backend, max_context_tokens=1000)

        result = rag.run("What does the plan cost?")
        payload = result.to_dict()

        self.assertEqual(result.answer, "The plan costs 100 dollars per month. [S1]")
        self.assertIn("confidence", payload)
        self.assertIn("confidence_label", payload)
        self.assertIn("confidence_breakdown", payload)
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)
        self.assertIn(result.confidence_label, {"high", "medium", "low"})
        self.assertTrue(backend.prompts)

    def test_empty_retrieval_produces_low_confidence(self) -> None:
        score = compute_final_confidence(
            compute_retrieval_confidence([]),
            compute_rerank_confidence([]),
            compute_grounding_confidence("I don't know based on the provided context.", ""),
            compute_answer_quality_confidence("I don't know based on the provided context.", "", 0.0),
        )
        self.assertLess(score, 0.65)
        self.assertEqual(confidence_label(score), "low")

    def test_conflicting_chunks_reduce_confidence(self) -> None:
        consistent = compute_final_confidence(
            compute_retrieval_confidence(
                [
                    SearchResult("1", "The plan costs 100 dollars.", {}, 0.1),
                    SearchResult("2", "The plan costs 100 dollars.", {}, 0.2),
                ]
            ),
            compute_rerank_confidence(
                [
                    RerankedResult("1", "The plan costs 100 dollars.", 0.9, 4.0, {}),
                    RerankedResult("2", "The plan costs 100 dollars.", 0.8, 0.0, {}),
                ]
            ),
            compute_grounding_confidence("The plan costs 100 dollars.", "The plan costs 100 dollars."),
            compute_answer_quality_confidence("The plan costs 100 dollars.", "The plan costs 100 dollars.", 1.0),
        )
        conflicting = compute_final_confidence(
            compute_retrieval_confidence(
                [
                    SearchResult("1", "The plan costs 100 dollars.", {}, 0.1),
                    SearchResult("2", "The plan costs 120 dollars.", {}, 0.2),
                ]
            ),
            compute_rerank_confidence(
                [
                    RerankedResult("1", "The plan costs 100 dollars.", 0.9, 0.61, {}),
                    RerankedResult("2", "The plan costs 120 dollars.", 0.8, 0.60, {}),
                ]
            ),
            compute_grounding_confidence("The plan costs 110 dollars.", "The plan costs 100 dollars. The plan costs 120 dollars."),
            compute_answer_quality_confidence("The plan costs 110 dollars.", "The plan costs 100 dollars. The plan costs 120 dollars.", 0.5),
        )

        self.assertGreater(consistent, conflicting)


if __name__ == "__main__":
    unittest.main()
