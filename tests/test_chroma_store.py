"""Tests for chunk indexing and Chroma store helpers."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from src.vectordb.chroma_store import ChromaStore, ChunkRecord, SearchResult, filter_search_results, load_chunk_records
from src.vectordb.retrieval import filter_search_results


class FakeEmbedder:
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 1.0] for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return [float(len(text)), 1.0]


class FakeCollection:
    def __init__(self) -> None:
        self.upserts: list[dict[str, object]] = []

    def upsert(self, **kwargs: object) -> None:
        self.upserts.append(kwargs)

    def query(self, **kwargs: object) -> dict[str, object]:
        return {
            "ids": [["chunk-1"]],
            "documents": [["Useful content"]],
            "metadatas": [[{"title": "Example", "url": "https://example.com"}]],
            "distances": [[0.12]],
        }


class ChromaStoreTests(unittest.TestCase):
    def test_load_chunk_records_flattens_chunk_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            chunks_dir = Path(temp_dir)
            (chunks_dir / "page.chunks.json").write_text(
                json.dumps(
                    [
                        {
                            "chunk_id": "chunk-1",
                            "content": "Useful content",
                            "url": "https://example.com",
                            "title": "Example",
                            "section": "Overview",
                            "token_count": 10,
                            "heading_path": ["Example", "Overview"],
                            "content_type": "table",
                            "source_section": "Overview",
                            "parent_chunk_id": "parent-1",
                            "split_index": 1,
                            "split_count": 2,
                        }
                    ]
                ),
                encoding="utf-8",
            )

            records = load_chunk_records(chunks_dir)

            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].chunk_id, "chunk-1")
            self.assertEqual(records[0].metadata["heading_path"], "Example > Overview")
            self.assertEqual(records[0].metadata["token_count"], 10)
            self.assertEqual(records[0].metadata["content_type"], "table")
            self.assertEqual(records[0].metadata["source_section"], "Overview")
            self.assertEqual(records[0].metadata["parent_chunk_id"], "parent-1")
            self.assertEqual(records[0].metadata["split_index"], 1)

    def test_upsert_chunks_batches_records(self) -> None:
        store = ChromaStore(chroma_dir=Path("unused"), collection_name="test")
        fake_collection = FakeCollection()
        store._collection = fake_collection

        indexed = store.upsert_chunks(
            [
                ChunkRecord("chunk-1", "First", {"title": "One"}),
                ChunkRecord("chunk-2", "Second", {"title": "Two"}),
            ],
            FakeEmbedder(),
            batch_size=1,
        )

        self.assertEqual(indexed, 2)
        self.assertEqual(len(fake_collection.upserts), 2)
        self.assertEqual(fake_collection.upserts[0]["ids"], ["chunk-1"])

    def test_search_parses_results(self) -> None:
        store = ChromaStore(chroma_dir=Path("unused"), collection_name="test")
        store._collection = FakeCollection()

        results = store.search("example query", FakeEmbedder(), top_k=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].chunk_id, "chunk-1")
        self.assertEqual(results[0].metadata["title"], "Example")
        self.assertEqual(results[0].distance, 0.12)

    def test_filter_search_results_removes_weak_matches(self) -> None:
        results = [
            SearchResult("near", "Near content", {}, 0.8),
            SearchResult("far", "Far content", {}, 1.4),
            SearchResult("missing", "No distance", {}, None),
        ]

        filtered = filter_search_results(results, max_distance=1.15)

        self.assertEqual([result.chunk_id for result in filtered], ["near"])

    def test_filter_search_results_keeps_exact_phrase_match(self) -> None:
        results = [
            SearchResult(
                "name",
                "Shiv Joshi is a Fullstack AI Engineer.",
                {},
                1.27,
            ),
            SearchResult(
                "country",
                "Ahmedabad, Gujarat, India",
                {},
                1.39,
            ),
        ]

        filtered = filter_search_results(results, query="who is Shiv Joshi?", max_distance=1.0)

        self.assertEqual([result.chunk_id for result in filtered], ["name"])


if __name__ == "__main__":
    unittest.main()
