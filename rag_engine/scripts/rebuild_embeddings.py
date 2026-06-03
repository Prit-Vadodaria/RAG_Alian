"""Rebuild embeddings/index from an explicit exported chunks directory."""

from __future__ import annotations

import argparse
from pathlib import Path

from src.config.settings import CHROMA_COLLECTION, CHROMA_DIR
from src.vectordb.chroma_store import index_exported_chunks


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chunks-dir", required=True, help="Path to a directory containing *.chunks.json files.")
    parser.add_argument("--collection-name", default=None)
    parser.add_argument("--chroma-dir", default=str(CHROMA_DIR))
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    summary = index_exported_chunks(
        chunks_dir=Path(args.chunks_dir),
        chroma_dir=Path(args.chroma_dir),
        collection_name=args.collection_name or CHROMA_COLLECTION,
    )
    print(f"Loaded chunks: {summary.loaded_chunks}")
    print(f"Indexed chunks: {summary.indexed_chunks}")
    print(f"Collection: {summary.collection_name}")
    print(f"Chroma directory: {summary.chroma_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
