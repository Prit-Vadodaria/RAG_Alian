"""CLI test helper for end-to-end RAG with Google Gemini generation."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.rag.rag_pipeline import RagPipeline
from src.config.logging_config import configure_logging


def _preview(text: str, size: int = 180) -> str:
    return " ".join(text.split())[:size]


def main() -> None:
    _configure_output_encoding()
    if len(sys.argv) < 2:
        print('Usage: python tests/test_rag.py "What is fixed-fee sprint pricing?"')
        raise SystemExit(1)

    query = " ".join(sys.argv[1:]).strip()
    configure_logging()

    pipeline = RagPipeline(final_top_k=5, max_context_tokens=1200)
    result = pipeline.run(query)

    print("\n=== RERANKER STATUS ===")
    print(f"{result.reranker_status}")

    print("\n=== RERANKED CHUNKS ===")
    for rank, item in enumerate(result.reranked_results, start=1):
        title = str(item.metadata.get("title") or item.metadata.get("url") or "untitled")
        print(f"{rank}. rerank_score={item.rerank_score:.4f} {title}")
        print(f"   {_preview(item.text)}")

    print("\n=== FINAL CONTEXT ===")
    print(result.context or "(empty)")

    print("\n=== GENERATED ANSWER ===")
    print(result.answer)

    print("\n=== CONFIDENCE ===")
    print(f"{result.confidence:.2f} ({result.confidence_label})")
    print(
        "retrieval="
        f"{result.confidence_breakdown['retrieval']:.2f} "
        "rerank="
        f"{result.confidence_breakdown['rerank']:.2f} "
        "grounding="
        f"{result.confidence_breakdown['grounding']:.2f} "
        "answer_quality="
        f"{result.confidence_breakdown['answer_quality']:.2f}"
    )

    print("\n=== CITATIONS / SOURCES ===")
    for source in result.sources:
        print(
            f"[{source.source_id}] {source.title} | {source.section} | {source.url} "
            f"(chunk={source.chunk_id}, rerank={source.rerank_score:.4f})"
        )

def _configure_output_encoding() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


if __name__ == "__main__":
    main()
