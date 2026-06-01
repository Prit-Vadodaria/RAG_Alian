"""Central registry for website contexts (ingestion status and paths)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.config.settings import BASE_DIR
from src.utils.url import normalize_url, urls_equivalent

REGISTRY_PATH = BASE_DIR / "context_registry.json"

READY_STATUSES = frozenset({"ready"})
ACTIVE_INGEST_STATUSES = frozenset({"ingesting"})
BLOCKED_RETRIEVAL_STATUSES = frozenset({"ingesting", "deleting", "failed"})


def _default_registry() -> dict[str, Any]:
    return {
        "version": 1,
        "contexts": [
            {
                "id": "alian_default",
                "name": "Alian Software",
                "seed_url": "",
                "status": "ready",
                "path": "data/indexes/chroma",
                "is_default": True,
                "is_deletable": False,
            }
        ],
    }


def load_registry() -> dict[str, Any]:
    if not REGISTRY_PATH.exists():
        data = _default_registry()
        save_registry(data)
        return data
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return _default_registry()


def save_registry(data: dict[str, Any]) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def list_contexts() -> list[dict[str, Any]]:
    return list(load_registry().get("contexts", []))


def get_context(context_id: str) -> dict[str, Any] | None:
    for entry in list_contexts():
        if entry.get("id") == context_id:
            return entry
    return None


def upsert_context(entry: dict[str, Any]) -> dict[str, Any]:
    data = load_registry()
    contexts: list[dict[str, Any]] = list(data.get("contexts", []))
    context_id = str(entry["id"])
    replaced = False
    for index, existing in enumerate(contexts):
        if existing.get("id") == context_id:
            contexts[index] = {**existing, **entry}
            replaced = True
            break
    if not replaced:
        contexts.append(entry)
    data["contexts"] = contexts
    save_registry(data)
    return get_context(context_id) or entry


def update_context_status(context_id: str, status: str, **extra: Any) -> dict[str, Any] | None:
    entry = get_context(context_id)
    if entry is None:
        return None
    entry["status"] = status
    entry.update(extra)
    return upsert_context(entry)


def remove_context(context_id: str) -> bool:
    if context_id == "alian_default":
        return False
    data = load_registry()
    before = len(data.get("contexts", []))
    data["contexts"] = [item for item in data.get("contexts", []) if item.get("id") != context_id]
    if len(data["contexts"]) == before:
        return False
    save_registry(data)
    return True


def find_by_seed_url(seed_url: str) -> dict[str, Any] | None:
    target = normalize_url(seed_url)
    for entry in list_contexts():
        existing = str(entry.get("seed_url", "")).strip()
        if existing and urls_equivalent(existing, target):
            return entry
    return None


def list_ready_website_contexts() -> list[dict[str, Any]]:
    ready: list[dict[str, Any]] = []
    for entry in list_contexts():
        if entry.get("id") == "alian_default":
            continue
        if entry.get("status") not in READY_STATUSES:
            continue
        ready.append(entry)
    return ready


def resolve_context_path(entry: dict[str, Any]) -> Path:
    rel = str(entry.get("path", "")).strip()
    if not rel:
        raise ValueError(f"Context {entry.get('id')} has no path")
    path = (BASE_DIR / rel).resolve()
    try:
        path.relative_to(BASE_DIR.resolve())
    except ValueError as exc:
        raise ValueError(f"Unsafe context path: {rel}") from exc
    return path


def embeddings_dir_for(entry: dict[str, Any]) -> Path:
    if entry.get("id") == "alian_default":
        from src.config.settings import CHROMA_DIR

        return Path(CHROMA_DIR)
    site_path = resolve_context_path(entry)
    legacy = site_path / "chroma"
    preferred = site_path / "embeddings"
    if preferred.exists():
        return preferred
    return legacy
