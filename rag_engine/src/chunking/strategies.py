"""Chunking strategies entrypoint.

Current project uses a single semantic markdown strategy from app.chunking.chunker.
"""

from src.chunking.chunker import build_chunks, split_markdown_blocks

__all__ = ["build_chunks", "split_markdown_blocks"]
