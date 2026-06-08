from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.api.guardrails import check_text
from src.rag.prompt_template import DEFAULT_CONSTRAINTS, DEFAULT_ROLE, normalize_prompt_settings

_SETTINGS_PATH = Path(__file__).resolve().parents[3] / "prompt_settings.json"


def get_default_settings() -> dict[str, object]:
    return {"role": DEFAULT_ROLE, "constraints": list(DEFAULT_CONSTRAINTS)}


def _validate_prompt_settings(role: str, constraints: list[str]) -> None:
    check_text(role, field_name="role")
    for index, item in enumerate(constraints):
        check_text(item, field_name=f"constraint[{index}]")


def load_prompt_settings() -> dict[str, object]:
    if not _SETTINGS_PATH.exists():
        return get_default_settings()
    try:
        raw = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return get_default_settings()

    role, constraints = normalize_prompt_settings(raw.get("role"), raw.get("constraints"))

    try:
        check_text(role, field_name="role")
    except ValueError:
        role = DEFAULT_ROLE

    safe_constraints: list[str] = []
    for item in constraints:
        try:
            check_text(item, field_name="constraint")
        except ValueError:
            continue
        safe_constraints.append(item)

    return {
        "role": role,
        "constraints": safe_constraints or list(DEFAULT_CONSTRAINTS),
        # Pass through audit fields if present, so the frontend can display them.
        "last_modified": raw.get("last_modified"),
        "last_modified_by": raw.get("last_modified_by"),
    }


def save_prompt_settings(
    role: str | None,
    constraints: list[str] | None,
    *,
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
    _validate_prompt_settings(norm_role, norm_constraints)
    payload = {
        "role": norm_role,
        "constraints": norm_constraints,
        "last_modified": datetime.now(timezone.utc).isoformat(),
        "last_modified_by": changed_by,
    }
    _SETTINGS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
