"""Rebuild embeddings/index from exported chunks."""

from __future__ import annotations

from src.vectordb.chroma_store import index_exported_chunks


def main() -> None:
    summary = index_exported_chunks()
    print(f"Loaded chunks: {summary.loaded_chunks}")
    print(f"Indexed chunks: {summary.indexed_chunks}")
    print(f"Collection: {summary.collection_name}")
    print(f"Chroma directory: {summary.chroma_dir}")


if __name__ == "__main__":
    main()
