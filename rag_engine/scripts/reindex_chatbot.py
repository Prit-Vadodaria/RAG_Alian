"""Reindex source chunks into the chatbot-scoped vector collection."""

from __future__ import annotations

import argparse
from pathlib import Path

from src.config.settings import BASE_DIR, CHATBOT_CHROMA_COLLECTION
from src.vectordb.chroma_store import index_exported_chunks


def _context_chunks_dir(context_id: str) -> Path:
    return BASE_DIR / "websites" / context_id / "chunks"


def _context_embeddings_dir(context_id: str) -> Path:
    return BASE_DIR / "websites" / context_id / "embeddings"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chatbot-id", required=True)
    parser.add_argument("--namespace", required=True)
    parser.add_argument(
        "--context-id",
        action="append",
        required=True,
        help="Source context id to reindex. Repeat for multiple contexts.",
    )
    parser.add_argument("--collection-name", default=CHATBOT_CHROMA_COLLECTION)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    total_loaded = 0
    total_indexed = 0
    collection_name = args.collection_name

    for context_id in args.context_id:
        chunks_dir = _context_chunks_dir(context_id)
        chroma_dir = _context_embeddings_dir(context_id)
        if not chunks_dir.exists():
            print(f"Skipping missing chunks directory: {chunks_dir}")
            continue

        summary = index_exported_chunks(
            chunks_dir=chunks_dir,
            chroma_dir=chroma_dir,
            collection_name=collection_name,
            metadata_overrides={
                "chatbot_id": args.chatbot_id,
                "namespace": args.namespace,
                "context_id": context_id,
                "tenant_id": args.chatbot_id,
            },
            chunk_id_prefix=f"{args.chatbot_id}:{context_id}",
        )
        total_loaded += summary.loaded_chunks
        total_indexed += summary.indexed_chunks
        print(
            f"Indexed context={context_id} loaded={summary.loaded_chunks} "
            f"indexed={summary.indexed_chunks} collection={summary.collection_name}"
        )

    print(f"Total loaded: {total_loaded}")
    print(f"Total indexed: {total_indexed}")
    print(f"Collection: {collection_name}")
    print(f"Chroma directory: {chroma_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
