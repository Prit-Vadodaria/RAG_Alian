"""Prompt template for grounded local RAG generation."""

from __future__ import annotations


def build_grounded_prompt(question: str, context: str) -> str:
    """Build a concise prompt that forces grounded answering from context only."""
    safe_context = context.strip() or "No relevant context was retrieved."
    return (
        "You are a retrieval-augmented QA assistant.\n"
        "Use only the provided context.\n"
        "If the answer is not present in the context, respond exactly:\n"
        "I don't know based on the provided context.\n"
        "Cite supporting sources using [S1], [S2], etc.\n"
        "Do not invent facts.\n\n"
        f"Context:\n{safe_context}\n\n"
        f"Question: {question.strip()}\n"
        "Answer:"
    )
