"""CLI smoke test for vector retrieval + reranking (target tests path)."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.retrieval.pipeline import FINAL_TOP_K, VECTOR_TOP_K, RetrievalPipeline
from src.config.logging_config import configure_logging
from src.utils.text import preview


def _title_or_url(metadata: dict) -> str:
    return str(metadata.get("title") or metadata.get("url") or "untitled")


def main() -> None:
    _configure_output_encoding()
    if len(sys.argv) < 2:
        print('Usage: python tests/test_retrieval.py "fixed-fee sprint pricing"')
        raise SystemExit(1)

    query = " ".join(sys.argv[1:]).strip()
    configure_logging()

    pipeline = RetrievalPipeline(vector_top_k=VECTOR_TOP_K, final_top_k=FINAL_TOP_K)
    vector_results, reranked_results = pipeline.retrieve(query)

    print("\n=== RERANKER STATUS ===")
    print(f"{pipeline.last_reranker_status}")

    print("\n=== VECTOR SEARCH RESULTS ===")
    print(f"Retrieved document count: {len(vector_results)}")
    for rank, doc in enumerate(vector_results, start=1):
        score = (1.0 / (1.0 + doc.distance)) if doc.distance is not None else None
        score_text = f"{score:.4f}" if score is not None else "n/a"
        print(f"{rank}. score={score_text} {_title_or_url(doc.metadata)}")
        print(f"   {preview(doc.content)}")

    print("\n=== RERANKED RESULTS ===")
    print(f"Final document count: {len(reranked_results)}")
    for rank, doc in enumerate(reranked_results, start=1):
        score_text = f"{doc.score:.4f}" if doc.score is not None else "n/a"
        print(f"{rank}. rerank_score={doc.rerank_score:.4f} score={score_text} {_title_or_url(doc.metadata)}")
        print(f"   {preview(doc.text)}")

def _configure_output_encoding() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


if __name__ == "__main__":
    main()
