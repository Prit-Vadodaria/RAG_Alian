from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.rag.prompts import (
    ChatbotPromptConfig,
    normalize_prompt_config,
    normalize_prompt_settings,
)
from src.rag.prompt_template import DEFAULT_CONSTRAINTS

_SETTINGS_PATH = Path(__file__).resolve().parents[3] / "prompt_settings.json"


def get_default_settings() -> dict[str, object]:
    config = normalize_prompt_config()
    return _config_to_payload(config)


def load_prompt_settings() -> dict[str, object]:
    if not _SETTINGS_PATH.exists():
        return get_default_settings()
    try:
        raw = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return get_default_settings()

    config = normalize_prompt_config(raw)
    payload = _config_to_payload(config)
    payload["last_modified"] = raw.get("last_modified")
    payload["last_modified_by"] = raw.get("last_modified_by")
    return payload


def save_prompt_settings(
    role: str | None,
    constraints: list[str] | None,
    *,
    tone: str | None = None,
    answer_style: str | None = None,
    fallback_behavior: str | None = None,
    strict_grounding: bool | None = None,
    allow_inference: bool | None = None,
    website_identity_mode: bool | None = None,
    changed_by: str = "api",
) -> dict[str, object]:
    """Persist prompt settings with an audit timestamp.

    Args:
        role: The new system role string.
        constraints: List of additional answer constraints.
        changed_by: Free-form label identifying who triggered the change
                    (e.g. "api", "admin-ui", a future user ID).
                    Stored in the JSON for audit purposes only.

    Returns:
        The normalised, persisted settings dict (matches GET response shape).
    """
    norm_role, norm_constraints = normalize_prompt_settings(role, constraints)
    config = normalize_prompt_config(
        {
            "role": norm_role,
            "constraints": norm_constraints,
            "tone": tone,
            "answer_style": answer_style,
            "fallback_behavior": fallback_behavior,
            "strict_grounding": strict_grounding,
            "allow_inference": allow_inference,
            "website_identity_mode": website_identity_mode,
        }
    )
    payload = _config_to_payload(config)
    payload["last_modified"] = datetime.now(timezone.utc).isoformat()
    payload["last_modified_by"] = changed_by
    _SETTINGS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def reset_prompt_settings(
    *,
    changed_by: str = "api",
) -> dict[str, object]:
    """Restore the canonical defaults without going through user-input validation."""
    payload = _config_to_payload(normalize_prompt_config())
    payload["last_modified"] = datetime.now(timezone.utc).isoformat()
    payload["last_modified_by"] = changed_by
    _SETTINGS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def _config_to_payload(config: ChatbotPromptConfig) -> dict[str, object]:
    return {
        "role": config.role,
        "tone": config.tone,
        "answer_style": config.answer_style,
        "fallback_behavior": config.fallback_behavior,
        "strict_grounding": config.strict_grounding,
        "allow_inference": config.allow_inference,
        "website_identity_mode": config.website_identity_mode,
        "constraints": list(config.constraints) or list(DEFAULT_CONSTRAINTS),
    }
