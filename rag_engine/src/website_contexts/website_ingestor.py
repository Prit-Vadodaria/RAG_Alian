"""Orchestration: discover → URL-by-URL crawl → process → buffered index.

Changes from original:
- URL-by-URL streaming pipeline. Each URL is crawled → cleaned → chunked →
  added to the embedding buffer → checkpointed before moving to the next URL.
- Buffered embedding indexing: flush to ChromaDB every
  EMBEDDING_INDEX_BATCH_SIZE embeddings (default 32) (issue #8).
- Pause: finish current URL completely before honouring pause request.
  Does NOT continue processing additional URLs after pause is requested (issue #9).
- Persistent checkpointing after every URL (issue #10).
- Resume from exact position: skips already-indexed URLs (issue #11).
- Progressive retrieval: status becomes "partially_ready" as soon as the
  first embedding batch is flushed (issue #12).
- Detailed observability metrics in progress + metadata (issue #13).
"""

from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.config.settings import (
    CHROMA_COLLECTION,
    EMBEDDING_INDEX_BATCH_SIZE,
    INGESTION_BATCH_SIZE,
)
from src.ingestion.crawler import crawl_urls
from src.ingestion.pipeline import BatchProcessingResult, process_raw_html_files
from src.utils.logging import close_logger, get_logger
from src.vectordb.chroma_store import ChunkRecord, index_chunk_records
from src.website_contexts.context_registry import update_context_status
from src.website_contexts.discoverer import DiscoveryResult, discover_internal_urls
from src.website_contexts.ingestion_registry import (
    IngestionProgress,
    RegistryEntry,
    clear_pause_flag,
    is_pause_requested,
    load_registry,
    load_registry_entries,
    save_registry,
    update_registry_entry,
)
from src.website_contexts.website_manager import (
    create_website_workspace,
    embeddings_dir,
    load_metadata,
    raw_dir,
    update_metadata,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _count_by_status(entries: list[RegistryEntry]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        counts[entry.status] = counts.get(entry.status, 0) + 1
    return counts


def _update_progress_metadata(
    website_id: str,
    *,
    site_path: Path,
    entries: list[RegistryEntry],
    progress: IngestionProgress,
    embedding_buffer_size: int = 0,
    current_url: str = "",
    stop_reason: str | None = None,
) -> None:
    counts = _count_by_status(entries)
    indexed_urls = counts.get("indexed", 0)
    pending_urls = counts.get("pending", 0)
    failed_urls = counts.get("failed", 0)
    skipped_urls = counts.get("skipped", 0)
    processed_urls = max(0, len(entries) - pending_urls)
    total_urls = len(entries)

    progress.total_urls = total_urls
    progress.pending_urls = pending_urls
    progress.processed_urls = processed_urls
    progress.indexed_urls = indexed_urls
    progress.failed_urls = failed_urls
    progress.stop_reason = stop_reason
    progress.updated_at = _utc_now()

    # Issue #12: mark partially_ready as soon as any embeddings are indexed.
    if progress.status not in {"paused", "failed"}:
        if pending_urls == 0 and indexed_urls > 0:
            progress.status = "ready"
        elif indexed_urls > 0:
            progress.status = "partially_ready"

    meta = load_metadata(website_id) or {}
    meta.update({
        "status": progress.status,
        "total_urls": total_urls,
        "pending_urls": pending_urls,
        "processed_urls": processed_urls,
        "indexed_urls": indexed_urls,
        "failed_urls": failed_urls,
        "skipped_urls": skipped_urls,
        # Issue #13: detailed observability
        "current_url": current_url,
        "embedding_buffer_size": embedding_buffer_size,
        "stop_reason": stop_reason or "",
        "ingestion_pid": progress.ingestion_pid,
        "updated_at": progress.updated_at,
    })
    update_metadata(website_id, meta)
    update_context_status(
        website_id,
        progress.status,
        total_urls=total_urls,
        pending_urls=pending_urls,
        processed_urls=processed_urls,
        indexed_urls=indexed_urls,
        failed_urls=failed_urls,
        current_url=current_url,
        embedding_buffer_size=embedding_buffer_size,
        stop_reason=stop_reason or "",
        ingestion_pid=progress.ingestion_pid,
    )


def _persist_checkpoint(
    *,
    website_id: str,
    site_path: Path,
    entries: list[RegistryEntry],
    progress: IngestionProgress,
    embedding_buffer_size: int = 0,
    current_url: str = "",
    stop_reason: str | None = None,
) -> None:
    """Save registry + metadata in one atomic step."""
    _update_progress_metadata(
        website_id,
        site_path=site_path,
        entries=entries,
        progress=progress,
        embedding_buffer_size=embedding_buffer_size,
        current_url=current_url,
        stop_reason=stop_reason,
    )
    save_registry(
        site_path,
        seed_url=progress.seed_url,
        entries=entries,
        progress=progress,
        stop_reason=stop_reason,
    )


def _load_or_discover_registry(
    *,
    website_id: str,
    seed_url: str,
    site_path: Path,
    logs_dir: Path,
) -> tuple[list[RegistryEntry], IngestionProgress, str | None]:
    existing = load_registry(site_path)
    entries = load_registry_entries(site_path)
    progress_data = existing.get("progress", {})
    if entries:
        progress = IngestionProgress(
            context_id=website_id,
            seed_url=str(progress_data.get("seed_url") or seed_url),
            total_urls=int(progress_data.get("total_urls") or len(entries)),
            pending_urls=int(progress_data.get("pending_urls") or 0),
            processed_urls=int(progress_data.get("processed_urls") or 0),
            indexed_urls=int(progress_data.get("indexed_urls") or 0),
            failed_urls=int(progress_data.get("failed_urls") or 0),
            current_batch=int(progress_data.get("current_batch") or 0),
            total_batches=int(progress_data.get("total_batches") or 0),
            last_completed_batch=int(progress_data.get("last_completed_batch") or 0),
            status=str(progress_data.get("status") or "processing"),
            stop_reason=progress_data.get("stop_reason"),
            ingestion_pid=os.getpid(),
        )
        return entries, progress, str(existing.get("stop_reason") or progress.stop_reason or "")

    discovery: DiscoveryResult = discover_internal_urls(seed_url, logs_dir=logs_dir, language="en")
    urls = discovery.urls
    entries = [RegistryEntry(url=url, status="pending", depth=0) for url in urls]
    progress = IngestionProgress(
        context_id=website_id,
        seed_url=seed_url,
        total_urls=len(entries),
        pending_urls=len(entries),
        status="discovering" if entries else "failed",
        stop_reason=discovery.stop_reason,
        ingestion_pid=os.getpid(),
    )
    save_registry(site_path, seed_url=seed_url, entries=entries, progress=progress, stop_reason=discovery.stop_reason)
    return entries, progress, discovery.stop_reason


def _flush_embedding_buffer(
    buffer: list[ChunkRecord],
    *,
    vector_dir: Path,
    logger,
    label: str = "",
) -> int:
    """Index all records in buffer to ChromaDB. Returns count indexed."""
    if not buffer:
        return 0
    summary = index_chunk_records(buffer, chroma_dir=vector_dir, collection_name=CHROMA_COLLECTION)
    logger.info(
        "Embedding flush%s loaded=%s indexed=%s",
        f" ({label})" if label else "",
        summary.loaded_chunks,
        summary.indexed_chunks,
    )
    buffer.clear()
    return summary.indexed_chunks


# ---------------------------------------------------------------------------
# Main ingestor
# ---------------------------------------------------------------------------

def ingest_website(seed_url: str, website_id: str, output_dir: Path) -> dict[str, Any]:
    """URL-by-URL ingestion with buffered indexing, checkpoint, and pause/resume."""
    site_path = Path(output_dir)
    logs_dir = site_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = get_logger("website_ingest", logs_dir / "ingest.log")

    display_name = _urlparse_host(seed_url)
    logger.info("Ingest started website_id=%s seed_url=%s output_dir=%s", website_id, seed_url, site_path)
    create_website_workspace(website_id, display_name, seed_url)
    update_metadata(website_id, {"status": "discovering", "ingestion_pid": os.getpid()})
    update_context_status(website_id, "discovering", ingestion_pid=os.getpid())

    try:
        html_dir = raw_dir(site_path)
        html_dir.mkdir(parents=True, exist_ok=True)
        vector_dir = embeddings_dir(site_path)
        vector_dir.mkdir(parents=True, exist_ok=True)
        metadata = load_metadata(website_id) or {}
        chunking = metadata.get("chunking") if isinstance(metadata, dict) else None

        entries, progress, stop_reason = _load_or_discover_registry(
            website_id=website_id,
            seed_url=seed_url,
            site_path=site_path,
            logs_dir=logs_dir,
        )
        if not entries:
            progress.status = "failed"
            _persist_checkpoint(
                website_id=website_id, site_path=site_path,
                entries=entries, progress=progress, stop_reason=stop_reason,
            )
            return {"id": website_id, "status": "failed", "summary": {"reason": "No discoverable URLs"}}

        progress.status = "processing"
        _persist_checkpoint(
            website_id=website_id, site_path=site_path,
            entries=entries, progress=progress, stop_reason=stop_reason,
        )

        # Shared dedup state across all URLs (issue #11: resume respects these)
        seen_hashes: set[str] = set()
        seen_fingerprints: list[set[str]] = []
        seen_chunk_hashes: set[str] = set()

        # Issue #8: embedding buffer — flush every EMBEDDING_INDEX_BATCH_SIZE records
        embedding_buffer: list[ChunkRecord] = []
        total_indexed = 0

        # Issue #11: resume — skip already-processed URLs
        pending_entries = [e for e in entries if e.status == "pending"]
        logger.info(
            "Processing started total=%s pending=%s already_indexed=%s",
            len(entries),
            len(pending_entries),
            len([e for e in entries if e.status == "indexed"]),
        )

        crawl_audit_file = logs_dir / "crawl_audit.jsonl"

        for entry in pending_entries:
            url = entry.url

            # Issue #9: check pause BEFORE starting a new URL (not mid-URL)
            if is_pause_requested(site_path):
                # Flush remaining buffer before pausing.
                if embedding_buffer:
                    total_indexed += _flush_embedding_buffer(
                        embedding_buffer, vector_dir=vector_dir, logger=logger, label="pre-pause flush"
                    )
                progress.status = "paused"
                _persist_checkpoint(
                    website_id=website_id, site_path=site_path,
                    entries=entries, progress=progress,
                    embedding_buffer_size=0, current_url="",
                    stop_reason=stop_reason,
                )
                logger.info("Pause requested — paused before processing url=%s", url)
                return _final_response(website_id, progress, entries, stop_reason, logger)

            logger.info("Processing URL url=%s", url)
            _persist_checkpoint(
                website_id=website_id, site_path=site_path,
                entries=entries, progress=progress,
                embedding_buffer_size=len(embedding_buffer),
                current_url=url, stop_reason=stop_reason,
            )

            # Step 1: Crawl
            crawl_results = crawl_urls(
                [url],
                output_dir=html_dir,
                workers=1,
                audit_file=crawl_audit_file,
                manifest_file=None,
                logs_dir=logs_dir,
            )

            crawl_result = crawl_results[0] if crawl_results else None
            if not crawl_result or not crawl_result.success or not crawl_result.output_path:
                update_registry_entry(
                    entries, url,
                    status="failed",
                    error=(crawl_result.error if crawl_result else "no crawl result"),
                )
                logger.warning("Crawl failed url=%s", url)
                _persist_checkpoint(
                    website_id=website_id, site_path=site_path,
                    entries=entries, progress=progress,
                    embedding_buffer_size=len(embedding_buffer),
                    current_url=url, stop_reason=stop_reason,
                )
                continue

            update_registry_entry(
                entries, url,
                status="crawled",
                output_path=str(crawl_result.output_path),
                crawled_at=_utc_now(),
            )

            # Step 2: Clean → chunk → collect records
            source_path = Path(crawl_result.output_path)
            batch_result: BatchProcessingResult = process_raw_html_files(
                [source_path],
                output_base_dir=site_path,
                chunking=chunking if isinstance(chunking, dict) else None,
                seen_hashes=seen_hashes,
                seen_fingerprints=seen_fingerprints,
                seen_chunk_hashes=seen_chunk_hashes,
            )

            update_registry_entry(entries, url, status="processed", processed_at=_utc_now())

            # Step 3: Add to embedding buffer
            embedding_buffer.extend(batch_result.chunk_records)
            logger.info(
                "URL processed url=%s chunks=%s buffer=%s",
                url,
                len(batch_result.chunk_records),
                len(embedding_buffer),
            )

            # Step 4: Flush buffer if it hits the batch size (issue #8)
            if len(embedding_buffer) >= EMBEDDING_INDEX_BATCH_SIZE:
                total_indexed += _flush_embedding_buffer(
                    embedding_buffer, vector_dir=vector_dir, logger=logger
                )
                update_registry_entry(entries, url, status="indexed", indexed_at=_utc_now())
                # Issue #12: mark partially_ready as soon as first flush succeeds
                if progress.status not in {"paused", "failed"}:
                    progress.status = "partially_ready"
            else:
                update_registry_entry(entries, url, status="indexed", indexed_at=_utc_now())

            # Issue #10: checkpoint after every URL
            _persist_checkpoint(
                website_id=website_id, site_path=site_path,
                entries=entries, progress=progress,
                embedding_buffer_size=len(embedding_buffer),
                current_url=url, stop_reason=stop_reason,
            )

        # Issue #8: final flush of remaining buffer
        if embedding_buffer:
            total_indexed += _flush_embedding_buffer(
                embedding_buffer, vector_dir=vector_dir, logger=logger, label="final flush"
            )

        # Final status
        counts = _count_by_status(entries)
        if counts.get("indexed", 0) > 0 and counts.get("pending", 0) == 0:
            progress.status = "ready"
        elif counts.get("indexed", 0) > 0:
            progress.status = "partially_ready"
        else:
            progress.status = "failed"

        _persist_checkpoint(
            website_id=website_id, site_path=site_path,
            entries=entries, progress=progress,
            embedding_buffer_size=0, current_url="",
            stop_reason=stop_reason,
        )
        logger.info(
            "Ingest completed website_id=%s indexed_urls=%s failed_urls=%s total_embeddings_flushed=%s status=%s",
            website_id,
            counts.get("indexed", 0),
            counts.get("failed", 0),
            total_indexed,
            progress.status,
        )
        return _final_response(website_id, progress, entries, stop_reason, logger)

    except Exception as exc:
        logger.exception("Ingest failed website_id=%s error=%s", website_id, exc)
        update_metadata(website_id, {"status": "failed", "error": str(exc), "ingestion_pid": os.getpid()})
        update_context_status(website_id, "failed", error=str(exc), ingestion_pid=os.getpid())
        try:
            (logs_dir / "ingest_error.log").write_text(traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass
        raise
    finally:
        clear_pause_flag(site_path)
        close_logger(logger)


def _final_response(
    website_id: str,
    progress: IngestionProgress,
    entries: list[RegistryEntry],
    stop_reason: str | None,
    logger,
) -> dict[str, Any]:
    counts = _count_by_status(entries)
    summary = {
        "total_urls": progress.total_urls,
        "pending_urls": progress.pending_urls,
        "processed_urls": progress.processed_urls,
        "indexed_urls": progress.indexed_urls,
        "failed_urls": progress.failed_urls,
        "urls_discovered": counts.get("indexed", 0) + counts.get("failed", 0),
        "urls_queued": len(entries),
        "urls_skipped": counts.get("skipped", 0),
        "status": progress.status,
        "stop_reason": stop_reason,
    }
    try:
        summary["registry"] = [entry.to_dict() for entry in entries]
    except Exception:
        summary["registry"] = []
    return {"id": website_id, "status": progress.status, "summary": summary}


def _urlparse_host(seed_url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(seed_url).netloc or seed_url
