"""Centralized prompt configuration and assembly utilities."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Mapping, Sequence

from src.api.guardrails import sanitize_constraints
from src.config.settings import (
    ALLOW_INFERENCE as DEFAULT_ALLOW_INFERENCE,
    DEFAULT_FALLBACK_BEHAVIOR,
    DEFAULT_PROMPT_CONSTRAINTS,
    DEFAULT_PROMPT_ROLE,
    DEFAULT_STYLE,
    DEFAULT_TONE,
    MANDATORY_PROMPT_CONSTRAINT,
    STRICT_GROUNDING as DEFAULT_STRICT_GROUNDING,
    WEBSITE_IDENTITY_MODE as DEFAULT_WEBSITE_IDENTITY_MODE,
)

_GENERIC_PHRASES = (
    "i don't know",
    "i do not know",
    "not enough information",
    "insufficient information",
    "cannot determine",
    "can't determine",
    "no relevant context",
    "not present in the context",
    "cannot answer",
    "couldn't find a clear answer",
    "can help with the related information that is available",
    "can share the related information that is available",
)


class ResponseMode(str, Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    GUIDED = "guided"
    FALLBACK = "fallback"


@dataclass(frozen=True)
class ChatbotPromptConfig:
    role: str = DEFAULT_PROMPT_ROLE
    tone: str = DEFAULT_TONE
    answer_style: str = DEFAULT_STYLE
    fallback_behavior: str = DEFAULT_FALLBACK_BEHAVIOR
    strict_grounding: bool = DEFAULT_STRICT_GROUNDING
    allow_inference: bool = DEFAULT_ALLOW_INFERENCE
    website_identity_mode: bool = DEFAULT_WEBSITE_IDENTITY_MODE
    constraints: tuple[str, ...] = DEFAULT_PROMPT_CONSTRAINTS


def normalize_prompt_settings(
    role: str | None,
    constraints: list[str] | None,
) -> tuple[str, list[str]]:
    cleaned_role = (role or "").strip()[:1000] or DEFAULT_PROMPT_ROLE

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


def normalize_prompt_config(
    prompt_settings: Mapping[str, object] | ChatbotPromptConfig | None = None,
    *,
    role: str | None = None,
    constraints: Sequence[str] | None = None,
) -> ChatbotPromptConfig:
    if isinstance(prompt_settings, ChatbotPromptConfig):
        return prompt_settings

    data: dict[str, object] = {}
    if isinstance(prompt_settings, Mapping):
        data.update(prompt_settings)

    if role is not None:
        data["role"] = role
    if constraints is not None:
        data["constraints"] = list(constraints)

    raw_constraints = data.get("constraints")
    normalized_role, normalized_constraints = normalize_prompt_settings(
        data.get("role") if isinstance(data.get("role"), str) or data.get("role") is None else str(data.get("role")),
        list(raw_constraints)
        if isinstance(raw_constraints, Sequence) and not isinstance(raw_constraints, (str, bytes))
        else None,
    )

    cleaned_constraints = tuple(
        sanitize_constraints(normalized_constraints or list(DEFAULT_PROMPT_CONSTRAINTS))
    )

    return ChatbotPromptConfig(
        role=normalized_role,
        tone=_clean_text(data.get("tone"), DEFAULT_TONE),
        answer_style=_clean_text(data.get("answer_style"), DEFAULT_STYLE),
        fallback_behavior=_clean_text(data.get("fallback_behavior"), DEFAULT_FALLBACK_BEHAVIOR),
        strict_grounding=_coerce_bool(data.get("strict_grounding"), DEFAULT_STRICT_GROUNDING),
        allow_inference=_coerce_bool(data.get("allow_inference"), DEFAULT_ALLOW_INFERENCE),
        website_identity_mode=_coerce_bool(data.get("website_identity_mode"), DEFAULT_WEBSITE_IDENTITY_MODE),
        constraints=cleaned_constraints,
    )


def build_grounded_prompt(
    question: str,
    context: str,
    *,
    role: str | None = None,
    additional_constraints: list[str] | None = None,
) -> str:
    config = normalize_prompt_config(role=role, constraints=additional_constraints)
    return build_answer_prompt(
        question,
        context,
        config=config,
        response_mode=ResponseMode.GUIDED,
    )


def build_answer_prompt(
    question: str,
    context: str,
    *,
    config: ChatbotPromptConfig | Mapping[str, object] | None = None,
    response_mode: ResponseMode = ResponseMode.GUIDED,
) -> str:
    active = normalize_prompt_config(config)
    safe_context = context.strip() or "No relevant website information was retrieved."
    safe_question = question.strip()

    constraint_lines = _assemble_constraints(active)
    response_mode_block = _response_mode_instructions(active, response_mode)
    voice_block = _voice_instructions(active)

    return (
        "<role>\n"
        f"{active.role}\n"
        "</role>\n\n"
        "<tone>\n"
        f"{active.tone}\n"
        "</tone>\n\n"
        "<style>\n"
        f"{active.answer_style}\n"
        "</style>\n\n"
        "<fallback_behavior>\n"
        f"{active.fallback_behavior}\n"
        "</fallback_behavior>\n\n"
        "<voice>\n"
        f"{voice_block}\n"
        "</voice>\n\n"
        "<response_mode>\n"
        f"{response_mode.value}\n"
        "</response_mode>\n\n"
        "<context>\n"
        f"{safe_context}\n"
        "</context>\n\n"
        "<question>\n"
        f"{safe_question}\n"
        "</question>\n\n"
        "<constraints>\n"
        f"{constraint_lines}\n"
        "</constraints>\n\n"
        "<instructions>\n"
        f"{response_mode_block}\n"
        "</instructions>\n\n"
        "Answer:"
    )


def build_recovery_prompt(
    question: str,
    context: str,
    *,
    config: ChatbotPromptConfig | Mapping[str, object] | None = None,
    response_mode: ResponseMode = ResponseMode.GUIDED,
) -> str:
    active = normalize_prompt_config(config)
    safe_context = context.strip() or "No relevant website information was retrieved."
    safe_question = question.strip()

    recovery_instructions = [
        "The user's question relates to the website.",
        "A direct answer may not be fully available.",
        "Share any relevant information.",
        "Explain what is known.",
        "Explain what can reasonably be concluded.",
        "Stay grounded in the website content.",
        "Do not invent facts.",
        "Remain helpful and conversational.",
        "Avoid dismissive responses.",
    ]
    if active.allow_inference:
        recovery_instructions.append("If an answer is clearly implied, state the implication carefully.")

    if active.website_identity_mode:
        recovery_instructions.append("Use first-person plural voice when speaking about the website.")

    return (
        "<role>\n"
        f"{active.role}\n"
        "</role>\n\n"
        "<tone>\n"
        f"{active.tone}\n"
        "</tone>\n\n"
        "<style>\n"
        f"{active.answer_style}\n"
        "</style>\n\n"
        "<fallback_behavior>\n"
        f"{active.fallback_behavior}\n"
        "</fallback_behavior>\n\n"
        "<response_mode>\n"
        f"{response_mode.value}\n"
        "</response_mode>\n\n"
        "<context>\n"
        f"{safe_context}\n"
        "</context>\n\n"
        "<question>\n"
        f"{safe_question}\n"
        "</question>\n\n"
        "<recovery_instructions>\n"
        + "\n".join(f"- {line}" for line in recovery_instructions)
        + "\n</recovery_instructions>\n\n"
        "Answer:"
    )


def build_graceful_fallback(
    question: str,
    *,
    config: ChatbotPromptConfig | Mapping[str, object] | None = None,
) -> str:
    active = normalize_prompt_config(config)
    behavior = active.fallback_behavior.strip().lower()
    if "concise" in behavior or "brief" in behavior:
        message = (
            "I couldn't find a clear answer on the website, but I can share the related "
            "information that is available. You may want to explore the most relevant section "
            "of the site or contact the team for more details."
        )
    else:
        message = (
            "I couldn't find a clear answer on the website, but I can help with the related "
            "information that is available. You may want to explore the most relevant section "
            "of the site or contact the team for more details."
        )
    if active.website_identity_mode:
        return message.replace("I couldn't", "We couldn't").replace("I can", "we can")
    return message


def select_initial_response_mode(
    *,
    retrieval_confidence: float,
    rerank_confidence: float,
    context: str,
    config: ChatbotPromptConfig | Mapping[str, object] | None = None,
) -> ResponseMode:
    active = normalize_prompt_config(config)
    if not context.strip():
        return ResponseMode.FALLBACK

    blended = (0.6 * retrieval_confidence) + (0.4 * rerank_confidence)
    if active.strict_grounding and blended >= 0.78:
        return ResponseMode.COMPLETE
    if blended >= 0.58:
        return ResponseMode.PARTIAL
    if active.allow_inference and blended >= 0.38:
        return ResponseMode.GUIDED
    return ResponseMode.GUIDED if active.allow_inference else ResponseMode.PARTIAL


def classify_response_mode(
    *,
    answer: str,
    context: str,
    confidence: float,
    config: ChatbotPromptConfig | Mapping[str, object] | None = None,
) -> ResponseMode:
    active = normalize_prompt_config(config)
    lowered = answer.strip().lower()
    if not answer.strip() or not context.strip():
        return ResponseMode.FALLBACK
    if any(phrase in lowered for phrase in _GENERIC_PHRASES):
        return ResponseMode.FALLBACK
    if confidence >= 0.82:
        return ResponseMode.COMPLETE
    if confidence >= 0.65:
        return ResponseMode.PARTIAL
    if confidence >= 0.45 and active.allow_inference:
        return ResponseMode.GUIDED
    return ResponseMode.GUIDED if active.allow_inference else ResponseMode.PARTIAL


def should_use_recovery(answer: str, confidence: float, context: str) -> bool:
    lowered = answer.strip().lower()
    if not answer.strip():
        return True
    if any(phrase in lowered for phrase in _GENERIC_PHRASES):
        return True
    if confidence < 0.5 and context.strip():
        return True
    return False


def _assemble_constraints(config: ChatbotPromptConfig) -> str:
    constraints = [MANDATORY_PROMPT_CONSTRAINT]
    for item in sanitize_constraints(list(config.constraints)):
        if item.casefold() == MANDATORY_PROMPT_CONSTRAINT.casefold():
            continue
        constraints.append(item)
    return "\n".join(f"- {constraint}" for constraint in constraints)


def _response_mode_instructions(
    config: ChatbotPromptConfig,
    response_mode: ResponseMode,
) -> str:
    lines = [
        "Always remain grounded in the website content.",
        "Never mention chunks, context, retrieval, sources or internal systems.",
        "Never expose technical implementation details.",
        "Never be dismissive unless no meaningful information exists.",
    ]

    if response_mode == ResponseMode.COMPLETE:
        lines.append("Provide a direct answer when the website clearly supports it.")
    elif response_mode == ResponseMode.PARTIAL:
        lines.append("Provide the supported part of the answer and keep it concise.")
    elif response_mode == ResponseMode.GUIDED:
        lines.append("Use related website information to guide the user helpfully.")
    else:
        lines.append("If nothing useful exists, respond with a brief helpful fallback.")

    if config.allow_inference:
        lines.append("If the answer is clearly implied, state the implication carefully.")
    if config.strict_grounding:
        lines.append("Do not invent facts that are not supported by the website.")
    if config.fallback_behavior:
        lines.append(f"Fallback behavior: {config.fallback_behavior}.")
    if config.website_identity_mode:
        lines.append("Speak as the website or company using 'we', 'our', and 'us'.")
    else:
        lines.append("Speak naturally in a neutral brand voice without first-person claims.")

    return "\n".join(f"- {line}" for line in lines)


def _voice_instructions(config: ChatbotPromptConfig) -> str:
    if config.website_identity_mode:
        return "Use first-person plural voice for the website or company."
    return "Use a natural third-person brand voice."


def _clean_text(value: object | None, default: str) -> str:
    if not isinstance(value, str):
        return default
    cleaned = value.strip()
    return cleaned or default


def _coerce_bool(value: object | None, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default
