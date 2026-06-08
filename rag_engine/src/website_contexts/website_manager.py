"""Manage per-website workspaces under rag_engine/websites/."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.config.settings import BASE_DIR

WEBSITES_DIR = BASE_DIR / "websites"
WEBSITES_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class WebsiteMetadata:
    id: str
    name: str
    url: str
    status: str = "discovering"
    is_deletable: bool = True
    pages_crawled: int = 0
    chunks_created: int = 0
    total_urls: int = 0
    pending_urls: int = 0
    processed_urls: int = 0
    indexed_urls: int = 0
    failed_urls: int = 0
    current_batch: int = 0
    total_batches: int = 0
    last_completed_batch: int = 0
    stop_reason: str = ""
    ingestion_pid: int | None = None


def website_path(context_id: str) -> Path:
    return WEBSITES_DIR / context_id


def metadata_file(context_id: str) -> Path:
    return website_path(context_id) / "metadata.json"


def raw_dir(site_path: Path) -> Path:
    preferred = site_path / "raw"
    legacy = site_path / "raw_html"
    if legacy.exists() and not preferred.exists():
        return legacy
    return preferred


def embeddings_dir(site_path: Path) -> Path:
    preferred = site_path / "embeddings"
    legacy = site_path / "chroma"
    if legacy.exists() and not preferred.exists():
        return legacy
    return preferred


def create_website_workspace(context_id: str, name: str, url: str) -> WebsiteMetadata:
    path = website_path(context_id)
    path.mkdir(parents=True, exist_ok=True)
    for sub in ("raw", "chunks", "embeddings", "logs", "cleaned_markdown", "structured_docs"):
        (path / sub).mkdir(parents=True, exist_ok=True)

    mf = metadata_file(context_id)
    if mf.exists():
        try:
            data = json.loads(mf.read_text(encoding="utf-8"))
            return WebsiteMetadata(
                id=data.get("id", context_id),
                name=data.get("name", name),
                url=data.get("url", url),
                status=data.get("status", "discovering"),
                is_deletable=data.get("is_deletable", True),
            )
        except Exception:
            pass

    meta = WebsiteMetadata(id=context_id, name=name, url=url, status="discovering")
    mf.write_text(json.dumps(meta.__dict__, ensure_ascii=False, indent=2), encoding="utf-8")
    return meta


def update_metadata(context_id: str, changes: dict[str, object]) -> WebsiteMetadata | None:
    mf = metadata_file(context_id)
    data: dict[str, Any] = {}
    if mf.exists():
        try:
            data = json.loads(mf.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    data.update(changes)
    mf.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return WebsiteMetadata(
        id=str(data.get("id", context_id)),
        name=str(data.get("name", "")),
        url=str(data.get("url", "")),
        status=str(data.get("status", "discovering")),
        is_deletable=bool(data.get("is_deletable", True)),
        pages_crawled=int(data.get("pages_crawled", 0)),
        chunks_created=int(data.get("chunks_created", 0)),
        total_urls=int(data.get("total_urls", 0)),
        pending_urls=int(data.get("pending_urls", 0)),
        processed_urls=int(data.get("processed_urls", 0)),
        indexed_urls=int(data.get("indexed_urls", 0)),
        failed_urls=int(data.get("failed_urls", 0)),
        current_batch=int(data.get("current_batch", 0)),
        total_batches=int(data.get("total_batches", 0)),
        last_completed_batch=int(data.get("last_completed_batch", 0)),
        stop_reason=str(data.get("stop_reason", "")),
        ingestion_pid=data.get("ingestion_pid"),
    )


def load_metadata(context_id: str) -> dict[str, Any] | None:
    mf = metadata_file(context_id)
    if not mf.exists():
        return None
    try:
        return json.loads(mf.read_text(encoding="utf-8"))
    except Exception:
        return None
