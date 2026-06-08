"""Persistent URL registry and ingestion progress for a website context."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


URL_STATUSES = ("pending", "crawled", "processed", "indexed", "failed")
INGESTION_STATUSES = ("discovering", "processing_batch", "partially_ready", "ready", "paused", "failed")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_read(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _json_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def url_registry_path(site_path: Path) -> Path:
    return site_path / "url_registry.json"


def pause_flag_path(site_path: Path) -> Path:
    return site_path / "pause.flag"


@dataclass
class RegistryEntry:
    url: str
    status: str = "pending"
    depth: int = 0
    batch_index: int = 0
    content_hash: str = ""
    output_path: str = ""
    error: str = ""
    crawled_at: str = ""
    processed_at: str = ""
    indexed_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IngestionProgress:
    context_id: str
    seed_url: str
    total_urls: int = 0
    pending_urls: int = 0
    processed_urls: int = 0
    indexed_urls: int = 0
    failed_urls: int = 0
    current_batch: int = 0
    total_batches: int = 0
    last_completed_batch: int = 0
    status: str = "discovering"
    stop_reason: str | None = None
    ingestion_pid: int | None = None
    created_at: str = field(default_factory=_utc_now)
    updated_at: str = field(default_factory=_utc_now)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def load_registry(site_path: Path) -> dict[str, Any]:
    raw = _json_read(url_registry_path(site_path))
    entries = raw.get("entries", [])
    if not isinstance(entries, list):
        entries = []
    normalized_entries: list[dict[str, Any]] = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        normalized_entries.append(
            RegistryEntry(
                url=url,
                status=str(item.get("status") or "pending"),
                depth=int(item.get("depth") or 0),
                batch_index=int(item.get("batch_index") or 0),
                content_hash=str(item.get("content_hash") or ""),
                output_path=str(item.get("output_path") or ""),
                error=str(item.get("error") or ""),
                crawled_at=str(item.get("crawled_at") or ""),
                processed_at=str(item.get("processed_at") or ""),
                indexed_at=str(item.get("indexed_at") or ""),
            ).to_dict()
        )

    progress = raw.get("progress", {})
    if not isinstance(progress, dict):
        progress = {}
    return {
        "version": int(raw.get("version") or 1),
        "seed_url": str(raw.get("seed_url") or ""),
        "stop_reason": raw.get("stop_reason"),
        "entries": normalized_entries,
        "progress": IngestionProgress(
            context_id=str(progress.get("context_id") or ""),
            seed_url=str(progress.get("seed_url") or ""),
            total_urls=int(progress.get("total_urls") or 0),
            pending_urls=int(progress.get("pending_urls") or 0),
            processed_urls=int(progress.get("processed_urls") or 0),
            indexed_urls=int(progress.get("indexed_urls") or 0),
            failed_urls=int(progress.get("failed_urls") or 0),
            current_batch=int(progress.get("current_batch") or 0),
            total_batches=int(progress.get("total_batches") or 0),
            last_completed_batch=int(progress.get("last_completed_batch") or 0),
            status=str(progress.get("status") or "discovering"),
            stop_reason=progress.get("stop_reason"),
            ingestion_pid=progress.get("ingestion_pid"),
            created_at=str(progress.get("created_at") or _utc_now()),
            updated_at=str(progress.get("updated_at") or _utc_now()),
        ).to_dict(),
    }


def save_registry(
    site_path: Path,
    *,
    seed_url: str,
    entries: list[RegistryEntry | dict[str, Any]],
    progress: IngestionProgress,
    stop_reason: str | None = None,
) -> None:
    payload = {
        "version": 1,
        "seed_url": seed_url,
        "stop_reason": stop_reason,
        "entries": [entry.to_dict() if isinstance(entry, RegistryEntry) else entry for entry in entries],
        "progress": progress.to_dict(),
    }
    _json_write(url_registry_path(site_path), payload)


def load_registry_entries(site_path: Path) -> list[RegistryEntry]:
    raw = load_registry(site_path)
    entries: list[RegistryEntry] = []
    for item in raw.get("entries", []):
        if not isinstance(item, dict):
            continue
        entries.append(
            RegistryEntry(
                url=str(item.get("url") or "").strip(),
                status=str(item.get("status") or "pending"),
                depth=int(item.get("depth") or 0),
                batch_index=int(item.get("batch_index") or 0),
                content_hash=str(item.get("content_hash") or ""),
                output_path=str(item.get("output_path") or ""),
                error=str(item.get("error") or ""),
                crawled_at=str(item.get("crawled_at") or ""),
                processed_at=str(item.get("processed_at") or ""),
                indexed_at=str(item.get("indexed_at") or ""),
            )
        )
    return entries


def save_pause_flag(site_path: Path) -> None:
    pause_flag_path(site_path).write_text(_utc_now(), encoding="utf-8")


def clear_pause_flag(site_path: Path) -> None:
    flag = pause_flag_path(site_path)
    if flag.exists():
        flag.unlink()


def is_pause_requested(site_path: Path) -> bool:
    return pause_flag_path(site_path).exists()


def update_registry_entry(
    entries: list[RegistryEntry],
    url: str,
    *,
    status: str | None = None,
    batch_index: int | None = None,
    content_hash: str | None = None,
    output_path: str | None = None,
    error: str | None = None,
    crawled_at: str | None = None,
    processed_at: str | None = None,
    indexed_at: str | None = None,
) -> None:
    for entry in entries:
        if entry.url == url:
            if status is not None:
                entry.status = status
            if batch_index is not None:
                entry.batch_index = batch_index
            if content_hash is not None:
                entry.content_hash = content_hash
            if output_path is not None:
                entry.output_path = output_path
            if error is not None:
                entry.error = error
            if crawled_at is not None:
                entry.crawled_at = crawled_at
            if processed_at is not None:
                entry.processed_at = processed_at
            if indexed_at is not None:
                entry.indexed_at = indexed_at
            return

