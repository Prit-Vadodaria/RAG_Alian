"""Orchestration wrapper: crawl → chunk → embed → vector (per website)."""

from __future__ import annotations

import traceback
from dataclasses import asdict
from pathlib import Path
from typing import Any

from src.ingestion.crawler import crawl_urls
from src.ingestion.pipeline import process_raw_html_directory
from src.utils.url import normalize_url
from src.vectordb.chroma_store import index_exported_chunks
from src.website_contexts.context_registry import update_context_status
from src.website_contexts.discoverer import discover_internal_urls
from src.website_contexts.website_manager import (
    create_website_workspace,
    embeddings_dir,
    load_metadata,
    raw_dir,
    update_metadata,
)


def _write_crawl_log(log_path: Path, lines: list[str]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def ingest_website(seed_url: str, website_id: str, output_dir: Path) -> dict[str, Any]:
    """Run the existing ingestion pipeline into an isolated website directory."""
    site_path = Path(output_dir)
    logs_dir = site_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    display_name = urlparse_host(seed_url)
    create_website_workspace(website_id, display_name, seed_url)
    update_metadata(website_id, {"status": "ingesting"})
    update_context_status(website_id, "ingesting")

    try:
        html_dir = raw_dir(site_path)
        html_dir.mkdir(parents=True, exist_ok=True)
        canonical_root = normalize_url(seed_url)
        metadata = load_metadata(website_id) or {}
        chunking = metadata.get("chunking") if isinstance(metadata, dict) else None

        discovered = discover_internal_urls(seed_url, logs_dir=logs_dir, language="en")
        if canonical_root not in discovered:
            discovered = [canonical_root] + discovered
        else:
            discovered = [canonical_root] + [item for item in discovered if item != canonical_root]

        crawl_audit_file = logs_dir / "crawl_audit.jsonl"
        crawl_results = crawl_urls(
            discovered,
            output_dir=html_dir,
            workers=1,
            audit_file=crawl_audit_file,
            manifest_file=None,
        )

        pages_crawled = sum(1 for result in crawl_results if getattr(result, "success", False))
        failed_crawls = [result for result in crawl_results if not result.success]
        crawl_log_lines = [
            f"URLs queued: {len(discovered)}",
            f"Pages crawled successfully: {pages_crawled}",
            f"Pages failed: {len(failed_crawls)}",
        ]
        for result in failed_crawls:
            crawl_log_lines.append(f"FAILED {result.url} status={result.status} error={result.error}")
        _write_crawl_log(logs_dir / "crawl.log", crawl_log_lines)
        update_metadata(website_id, {"pages_crawled": pages_crawled})

        summary = process_raw_html_directory(
            input_dir=html_dir,
            workers=1,
            output_base_dir=site_path,
            chunking=chunking if isinstance(chunking, dict) else None,
        )

        chunks_dir = site_path / "chunks"
        vector_dir = embeddings_dir(site_path)
        vector_dir.mkdir(parents=True, exist_ok=True)
        index_exported_chunks(chunks_dir=chunks_dir, chroma_dir=vector_dir)

        chunks_created = int(getattr(summary, "exported_chunks", 0))
        update_metadata(
            website_id,
            {"status": "ready", "chunks_created": chunks_created},
        )
        update_context_status(website_id, "ready", chunks_created=chunks_created)

        try:
            summary_obj: dict[str, Any] = asdict(summary)
        except Exception:
            summary_obj = {
                "exported_chunks": chunks_created,
                "processed_documents": getattr(summary, "processed_documents", 0),
            }

        return {"id": website_id, "status": "ready", "summary": summary_obj}
    except Exception as exc:
        update_metadata(website_id, {"status": "failed", "error": str(exc)})
        update_context_status(website_id, "failed", error=str(exc))
        try:
            log_path = logs_dir / "ingest_error.log"
            log_path.write_text(traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass
        raise


def urlparse_host(seed_url: str) -> str:
    from urllib.parse import urlparse

    return urlparse(seed_url).netloc or seed_url
