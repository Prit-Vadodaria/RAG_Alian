"""Diagnostics tests for retrieval -> reranking -> context flow."""

from __future__ import annotations

import sys
import unittest
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.rag.context_builder import build_context
from src.rag.rag_pipeline import RagPipeline
from src.retrieval.pipeline import RetrievalPipeline
from src.retrieval.reranker import RerankedResult, Reranker
from src.retrieval.validators import (
    extract_doc_text,
    truncate_text_for_rerank,
    validate_docs,
    validate_pairs,
    validate_ranking,
    validate_scores,
)
from src.vectordb.chroma_store import SearchResult
import main as app_main


class FakeRetriever:
    def __init__(self, docs: list[SearchResult]) -> None:
        self.docs = docs
        self.calls: list[str] = []

    def retrieve(self, query: str) -> list[SearchResult]:
        self.calls.append(query)
        return self.docs


class FakeReranker:
    def __init__(self, scores: list[float] | Exception) -> None:
        self.scores = scores
        self.calls: list[tuple[str, list[str]]] = []

    def rerank(self, query: str, documents: list[SearchResult]) -> list[RerankedResult]:
        self.calls.append((query, [doc.content for doc in documents]))
        if isinstance(self.scores, Exception):
            raise self.scores
        if len(self.scores) != len(documents):
            raise ValueError("score/doc mismatch")
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
    def __init__(self) -> None:
        self.prompts: list[str] = []

    def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return "Answer [S1]"


class RerankingDiagnosticsTests(unittest.TestCase):
    def test_extract_doc_text_handles_dict_and_page_content(self) -> None:
        self.assertEqual(extract_doc_text({"text": "hello"}), "hello")
        self.assertEqual(extract_doc_text(SimpleNamespace(page_content="world")), "world")

    def test_validate_docs_rejects_empty_text(self) -> None:
        with self.assertRaises(ValueError):
            validate_docs([SearchResult("id", "", {}, 0.1)])

    def test_validate_pairs_rejects_invalid_inputs(self) -> None:
        with self.assertRaises(ValueError):
            validate_pairs("", [SearchResult("id", "text", {}, 0.1)])
        with self.assertRaises(ValueError):
            validate_pairs("query", [SearchResult("id", "", {}, 0.1)])

    def test_validate_pairs_and_scores_and_ranking(self) -> None:
        docs = [SearchResult("a", "A", {}, 0.1), SearchResult("b", "B", {}, 0.2)]
        pairs = validate_pairs("query", docs)
        self.assertEqual(len(pairs), 2)
        scores = validate_scores([0.9, 0.8], docs)
        self.assertEqual(len(scores), 2)
        self.assertTrue(validate_ranking(scores))
        self.assertFalse(validate_ranking([0.1, 0.9]))

    def test_validate_scores_rejects_mismatch(self) -> None:
        docs = [SearchResult("a", "A", {}, 0.1)]
        with self.assertRaises(ValueError):
            validate_scores([0.1, 0.2], docs)

    def test_reranker_warmup_populates_runtime_cache(self) -> None:
        class FakeRuntime:
            def __init__(self, model_name: str) -> None:
                self.model_name = model_name
                self.load_seconds = 0.123

        with patch("src.retrieval.reranker._CrossEncoderRuntime", FakeRuntime):
            Reranker._runtime_cache.clear()
            try:
                reranker = Reranker.warmup(model_name="test-model", backend="auto")
                self.assertEqual(reranker.last_backend, "cross_encoder")
                self.assertEqual(reranker.last_status, "ready")
                self.assertIn("test-model", Reranker._runtime_cache)
                self.assertEqual(Reranker._runtime_cache["test-model"].model_name, "test-model")
            finally:
                Reranker._runtime_cache.clear()

    def test_cli_warmup_helper_calls_reranker_warmup(self) -> None:
        class FakeWarmupResult:
            last_backend = "cross_encoder"
            last_status = "ready"
            last_load_seconds = 0.123

        stdout = StringIO()
        fake_settings = SimpleNamespace(
            ENABLE_RERANKER=True,
            RERANKER_MODEL="test-model",
            RERANKER_USE_FP16=False,
            RERANKER_INIT_TIMEOUT_SECONDS=30,
            RERANKER_BACKEND="auto",
        )
        with (
            patch("main.settings", fake_settings),
            patch("main.Reranker.warmup", return_value=FakeWarmupResult()) as mock_warmup,
            patch("sys.stdout", stdout),
        ):
            app_main._warmup_reranker()

        mock_warmup.assert_called_once()
        output = stdout.getvalue()
        self.assertIn("Reranker warmup complete:", output)
        self.assertIn("backend=cross_encoder", output)
        self.assertIn("status=ready", output)

    def test_retrieval_reranking_changes_order(self) -> None:
        docs = [
            SearchResult("1", "first", {"title": "One"}, 0.9),
            SearchResult("2", "second", {"title": "Two"}, 0.2),
        ]
        pipeline = RetrievalPipeline(
            vector_top_k=2,
            final_top_k=2,
            retriever=FakeRetriever(docs),
            reranker=FakeReranker([0.1, 0.99]),
        )

        vector_results, reranked = pipeline.retrieve("pricing")

        self.assertEqual([doc.chunk_id for doc in vector_results], ["1", "2"])
        self.assertEqual([doc.chunk_id for doc in reranked], ["2", "1"])
        self.assertEqual(pipeline.last_reranker_status, "success")

    def test_fallback_returns_vector_order(self) -> None:
        docs = [
            SearchResult("1", "first", {"title": "One"}, 0.9),
            SearchResult("2", "second", {"title": "Two"}, 0.2),
        ]
        pipeline = RetrievalPipeline(
            vector_top_k=2,
            final_top_k=2,
            retriever=FakeRetriever(docs),
            reranker=FakeReranker(RuntimeError("boom")),
        )

        vector_results, reranked = pipeline.retrieve("pricing")

        self.assertEqual([doc.chunk_id for doc in vector_results], ["1", "2"])
        self.assertEqual([doc.chunk_id for doc in reranked], ["1", "2"])
        self.assertEqual(pipeline.last_reranker_status, "fallback")

    def test_empty_retrieval_does_not_crash(self) -> None:
        pipeline = RetrievalPipeline(
            vector_top_k=2,
            final_top_k=2,
            retriever=FakeRetriever([]),
            reranker=FakeReranker([0.5]),
        )

        vector_results, reranked = pipeline.retrieve("pricing")

        self.assertEqual(vector_results, [])
        self.assertEqual(reranked, [])
        self.assertEqual(pipeline.last_reranker_status, "empty_retrieval")

    def test_context_builder_truncates_oversized_context(self) -> None:
        long_text = "word " * 500
        context, sources = build_context(
            [
                RerankedResult(
                    chunk_id="chunk-1",
                    text=long_text,
                    score=0.1,
                    rerank_score=0.9,
                    metadata={"title": "Long", "url": "https://example.com", "section": "Body"},
                )
            ],
            max_context_tokens=5,
        )
        self.assertTrue(context)
        self.assertTrue(sources)
        self.assertLessEqual(len(context), len(long_text))

    def test_rag_pipeline_end_to_end_context_and_prompt(self) -> None:
        docs = [
            SearchResult("1", "fixed fee sprint pricing details", {"title": "Pricing", "url": "https://example.com/pricing", "section": "Sprint"}, 0.2),
            SearchResult("2", "other chunk", {"title": "Other", "url": "https://example.com/other", "section": "Other"}, 0.4),
        ]
        retrieval_pipeline = RetrievalPipeline(
            vector_top_k=2,
            final_top_k=2,
            retriever=FakeRetriever(docs),
            reranker=FakeReranker([0.2, 0.9]),
        )
        backend = FakeGenerationBackend()
        rag = RagPipeline(retrieval_pipeline=retrieval_pipeline, generation_backend=backend, max_context_tokens=1000)

        result = rag.run("What is fixed-fee sprint pricing?")

        self.assertTrue(result.context)
        self.assertTrue(result.sources)
        self.assertEqual(result.reranker_status, "success")
        self.assertTrue(backend.prompts)
        self.assertIn("Question: What is fixed-fee sprint pricing?", backend.prompts[0])
        self.assertIn("Context:", backend.prompts[0])
        self.assertIn("fixed fee sprint pricing details", backend.prompts[0])

    def test_truncate_text_for_rerank_limits_input_size(self) -> None:
        text = "token " * 400
        truncated = truncate_text_for_rerank(text, max_words=32, max_chars=200)
        self.assertLessEqual(len(truncated.split()), 32)
        self.assertLessEqual(len(truncated), 200)


if __name__ == "__main__":
    unittest.main()
