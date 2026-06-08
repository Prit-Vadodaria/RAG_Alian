"""Prompt template for grounded local RAG generation."""

from __future__ import annotations

from src.api.guardrails import sanitize_constraints

DEFAULT_ROLE = "You are a retrieval-augmented QA assistant."
MANDATORY_CONSTRAINT = "Answer ONLY from the provided context."
DEFAULT_CONSTRAINTS = [
    "Do not invent facts.",
    "Cite supporting sources using [S1], [S2], etc.",
    "If the answer is not present, respond exactly:\n\"I don't know based on the provided context.\"",
]


def normalize_prompt_settings(
    role: str | None,
    constraints: list[str] | None,
) -> tuple[str, list[str]]:
    cleaned_role = (role or "").strip()[:1000] or DEFAULT_ROLE

    seen: set[str] = set()
    cleaned_constraints: list[str] = []
    for item in constraints or []:
        if not isinstance(item, str):
            continue
        line = item.strip()
        if not line:
            continue
        key = line.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned_constraints.append(line)

    return cleaned_role, cleaned_constraints


def build_grounded_prompt(
    question: str,
    context: str,
    *,
    role: str | None = None,
    additional_constraints: list[str] | None = None,
) -> str:
    """Build a grounded prompt with fixed structure and mandatory constraints.

    MANDATORY_CONSTRAINT is always the first bullet regardless of what
    additional_constraints contain. sanitize_constraints drops any user
    constraint that would contradict grounding or citation requirements.
    """
    safe_context = context.strip() or "No relevant context was retrieved."
    safe_question = question.strip()
    effective_role, user_constraints = normalize_prompt_settings(
        role, additional_constraints
    )

    # Layer 3 hard-pin: sanitize at build time even if validation was bypassed.
    safe_user_constraints = sanitize_constraints(user_constraints)

    constraint_lines = [
        f"- {MANDATORY_CONSTRAINT}",  # always first, always present
        "- Do not invent facts.",
        "- Cite supporting sources using [S1], [S2], etc.",
        "- If the answer is missing, respond exactly:\n  \"I don't know based on the provided context.\"",
    ]

    for c in safe_user_constraints:
        if MANDATORY_CONSTRAINT.casefold() in c.casefold():
            continue  # deduplicate
        constraint_lines.append(f"- {c}")

    constraints_block = "\n".join(constraint_lines)

    return (
        "<role>\n"
        f"{effective_role}\n"
        "</role>\n\n"
        "<context>\n"
        f"{safe_context}\n"
        "</context>\n\n"
        "<question>\n"
        f"{safe_question}\n"
        "</question>\n\n"
        "<constraints>\n"
        f"{constraints_block}\n"
        "</constraints>\n\n"
        "Answer:"
    )