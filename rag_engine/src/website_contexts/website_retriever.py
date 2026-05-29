"""Helpers to create a retriever pointing at a website-specific Chroma DB."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from src.config.settings import BASE_DIR, CHROMA_COLLECTION
from src.vectordb.chroma_store import search_index


def website_chroma_dir(context_id: str) -> Path:
    return BASE_DIR / "websites" / context_id / "chroma"


def search_website_index(query: str, context_id: str, *, top_k: int = 20, max_distance: float | None = None):
    chroma_dir = website_chroma_dir(context_id)
    return search_index(query, chroma_dir=chroma_dir, collection_name=CHROMA_COLLECTION, top_k=top_k, max_distance=max_distance)
