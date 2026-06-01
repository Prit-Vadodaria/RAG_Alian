"""Context assembly utilities for lightweight local RAG generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from src.chunking.token_utils import TokenCounter
from src.config.settings import RAG_CONTEXT_TOKENS
from src.rag.citations import citation_tag, source_id_for_index
from src.retrieval.reranker import RerankedResult


@dataclass(frozen=True)
class ContextSource:
    """Citation/source metadata for one included chunk."""

    source_id: str
    title: str
    url: str
    section: str
    chunk_id: str
    rerank_score: float
    text: str
    similarity: float | None


def build_context(
    results: Iterable[RerankedResult],
    *,
    max_context_tokens: int = RAG_CONTEXT_TOKENS,
    token_counter: TokenCounter | None = None,
) -> tuple[str, list[ContextSource]]:
    """Build compact, citation-tagged context from reranked results."""
    counter = token_counter or TokenCounter()
    used: set[tuple[str, str, str]] = set()
    parts: list[str] = []
    sources: list[ContextSource] = []
    used_tokens = 0

    for result in results:
        text = result.text.strip()
        if not text:
            continue

        title = str(result.metadata.get("title", "")).strip()
        url = str(result.metadata.get("url", "")).strip()
        section = str(result.metadata.get("section", "")).strip()
        dedupe_key = (url, section, text)
        if dedupe_key in used:
            continue

        source_id = source_id_for_index(len(sources) + 1)
        block = _format_context_block(source_id, title, url, section, text, result.rerank_score)
        block_tokens = counter.count(block)
        if used_tokens + block_tokens > max_context_tokens:
            if not parts:
                trimmed = counter.trim_to_token_count(block, max_context_tokens)
                if trimmed.strip():
                    parts.append(trimmed)
                    sources.append(
                        ContextSource(
                            source_id,
                            title,
                            url,
                            section,
                            result.chunk_id,
                            result.rerank_score,
                            result.text,
                            result.score,
                        )
                    )
            break

        parts.append(block)
        sources.append(
            ContextSource(
                source_id,
                title,
                url,
                section,
                result.chunk_id,
                result.rerank_score,
                result.text,
                result.score,
            )
        )
        used.add(dedupe_key)
        used_tokens += block_tokens

    return "\n\n---\n\n".join(parts), sources


def _format_context_block(source_id: str, title: str, url: str, section: str, text: str, rerank_score: float) -> str:
    return (
        f"{citation_tag(source_id)}\n"
        f"Title: {title}\n"
        f"URL: {url}\n"
        f"Section: {section}\n"
        f"Rerank Score: {rerank_score:.4f}\n"
        f"Content:\n{text}"
    )
