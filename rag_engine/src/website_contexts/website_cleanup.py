"""Safe deletion of website sandboxes under rag_engine/websites/."""

from __future__ import annotations

import shutil
from pathlib import Path

from src.website_contexts.context_registry import remove_context, update_context_status
from src.website_contexts.website_manager import WEBSITES_DIR, website_path


def _is_safe_website_path(target: Path) -> bool:
    try:
        target.resolve().relative_to(WEBSITES_DIR.resolve())
        return True
    except ValueError:
        return False


def delete_website_context(context_id: str) -> bool:
    site_dir = website_path(context_id)
    if not _is_safe_website_path(site_dir):
        raise ValueError(f"Refusing to delete unsafe path: {site_dir}")

    update_context_status(context_id, "deleting")

    if site_dir.exists():
        shutil.rmtree(site_dir, ignore_errors=True)

    remove_context(context_id)
    return True
