from __future__ import annotations

import json
from pathlib import Path

from src.rag.prompt_template import DEFAULT_CONSTRAINTS, DEFAULT_ROLE, normalize_prompt_settings

_SETTINGS_PATH = Path(__file__).resolve().parents[3] / "prompt_settings.json"


def get_default_settings() -> dict[str, object]:
    return {"role": DEFAULT_ROLE, "constraints": list(DEFAULT_CONSTRAINTS)}


def load_prompt_settings() -> dict[str, object]:
    if not _SETTINGS_PATH.exists():
        return get_default_settings()
    try:
        raw = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return get_default_settings()

    role, constraints = normalize_prompt_settings(raw.get("role"), raw.get("constraints"))
    return {"role": role, "constraints": constraints or list(DEFAULT_CONSTRAINTS)}


def save_prompt_settings(role: str | None, constraints: list[str] | None) -> dict[str, object]:
    norm_role, norm_constraints = normalize_prompt_settings(role, constraints)
    payload = {
        "role": norm_role,
        "constraints": norm_constraints,
    }
    _SETTINGS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
