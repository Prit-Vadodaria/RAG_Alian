"""Orchestration wrapper: discover -> batch crawl -> batch process -> batch index."""

from __future__ import annotations

import math
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.config.settings import CHROMA_COLLECTION, INGESTION_BATCH_SIZE
from src.ingestion.crawler import crawl_urls
from src.ingestion.pipeline import BatchProcessingResult, process_raw_html_files
from src.utils.logging import close_logger, get_logger
from src.vectordb.chroma_store import index_chunk_records
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


def _write_crawl_log(log_path: Path, lines: list[str]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as file:
        file.write("\n".join(lines) + "\n")


def _count_by_status(entries: list[RegistryEntry]) -> dict[str, int]:
    counts = {"pending": 0, "crawled": 0, "processed": 0, "indexed": 0, "failed": 0}
    for entry in entries:
        counts[entry.status] = counts.get(entry.status, 0) + 1
    return counts


def _update_progress_metadata(
    website_id: str,
    *,
    site_path: Path,
    entries: list[RegistryEntry],
    progress: IngestionProgress,
    stop_reason: str | None = None,
) -> None:
    counts = _count_by_status(entries)
    indexed_urls = counts.get("indexed", 0)
    pending_urls = counts.get("pending", 0)
    processed_urls = max(0, len(entries) - pending_urls)
    failed_urls = counts.get("failed", 0)
    total_urls = len(entries)
    total_batches = math.ceil(total_urls / INGESTION_BATCH_SIZE) if total_urls else 0

    progress.total_urls = total_urls
    progress.pending_urls = pending_urls
    progress.processed_urls = processed_urls
    progress.indexed_urls = indexed_urls
    progress.failed_urls = failed_urls
    progress.total_batches = total_batches
    progress.stop_reason = stop_reason
    progress.updated_at = _utc_now()

    if progress.status not in {"paused", "failed"}:
        if pending_urls == 0 and failed_urls == 0 and indexed_urls > 0:
            progress.status = "ready"
        elif indexed_urls > 0:
            progress.status = "partially_ready"

    meta = load_metadata(website_id) or {}
    meta.update(
        {
            "status": progress.status,
            "total_urls": total_urls,
            "pending_urls": pending_urls,
            "processed_urls": processed_urls,
            "indexed_urls": indexed_urls,
            "failed_urls": failed_urls,
            "current_batch": progress.current_batch,
            "total_batches": total_batches,
            "last_completed_batch": progress.last_completed_batch,
            "stop_reason": stop_reason or "",
            "ingestion_pid": progress.ingestion_pid,
        }
    )
    update_metadata(website_id, meta)
    update_context_status(
        website_id,
        progress.status,
        total_urls=total_urls,
        pending_urls=pending_urls,
        processed_urls=processed_urls,
        indexed_urls=indexed_urls,
        failed_urls=failed_urls,
        current_batch=progress.current_batch,
        total_batches=total_batches,
        last_completed_batch=progress.last_completed_batch,
        stop_reason=stop_reason or "",
        ingestion_pid=progress.ingestion_pid,
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
            status=str(progress_data.get("status") or "processing_batch"),
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


def _batch_urls(entries: list[RegistryEntry]) -> list[list[RegistryEntry]]:
    batch_size = max(1, INGESTION_BATCH_SIZE)
    return [entries[index : index + batch_size] for index in range(0, len(entries), batch_size)]


def _mark_batch_completion(
    *,
    website_id: str,
    site_path: Path,
    entries: list[RegistryEntry],
    progress: IngestionProgress,
    stop_reason: str | None,
) -> None:
    _update_progress_metadata(
        website_id,
        site_path=site_path,
        entries=entries,
        progress=progress,
        stop_reason=stop_reason,
    )
    save_registry(site_path, seed_url=progress.seed_url, entries=entries, progress=progress, stop_reason=stop_reason)


def ingest_website(seed_url: str, website_id: str, output_dir: Path) -> dict[str, Any]:
    """Run the existing ingestion pipeline into an isolated website directory."""
    site_path = Path(output_dir)
    logs_dir = site_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = get_logger("website_ingest", logs_dir / "ingest.log")

    display_name = urlparse_host(seed_url)
    logger.info("Ingest started website_id=%s seed_url=%s output_dir=%s", website_id, seed_url, site_path)
    create_website_workspace(website_id, display_name, seed_url)
    update_metadata(
        website_id,
        {
            "status": "discovering",
            "ingestion_pid": os.getpid(),
        },
    )
    update_context_status(website_id, "discovering", ingestion_pid=os.getpid())

    try:
        html_dir = raw_dir(site_path)
        html_dir.mkdir(parents=True, exist_ok=True)
        vector_dir = embeddings_dir(site_path)
        vector_dir.mkdir(parents=True, exist_ok=True)
        metadata = load_metadata(website_id) or {}
        chunking = metadata.get("chunking") if isinstance(metadata, dict) else None
        logger.info("Workspace prepared html_dir=%s chunking=%s", html_dir, chunking if isinstance(chunking, dict) else None)

        entries, progress, stop_reason = _load_or_discover_registry(
            website_id=website_id,
            seed_url=seed_url,
            site_path=site_path,
            logs_dir=logs_dir,
        )
        if not entries:
            progress.status = "failed"
            _mark_batch_completion(
                website_id=website_id,
                site_path=site_path,
                entries=entries,
                progress=progress,
                stop_reason=stop_reason,
            )
            return {"id": website_id, "status": "failed", "summary": {"reason": "No discoverable URLs"}}

        if progress.status != "ready":
            progress.status = "processing_batch"

        batches = _batch_urls(entries)
        progress.total_batches = len(batches)
        _mark_batch_completion(
            website_id=website_id,
            site_path=site_path,
            entries=entries,
            progress=progress,
            stop_reason=stop_reason,
        )

        seen_hashes: set[str] = set()
        seen_fingerprints: list[set[str]] = []
        seen_chunk_hashes: set[str] = set()
        completed_batches = progress.last_completed_batch
        for batch_number, batch_entries in enumerate(batches, start=1):
            if batch_number <= completed_batches:
                continue

            if is_pause_requested(site_path):
                progress.status = "paused"
                _mark_batch_completion(
                    website_id=website_id,
                    site_path=site_path,
                    entries=entries,
                    progress=progress,
                    stop_reason=stop_reason,
                )
                logger.info("Pause requested before batch %s", batch_number)
                return _final_response(website_id, progress, entries, stop_reason, logger)

            progress.current_batch = batch_number
            progress.status = "processing_batch"
            _mark_batch_completion(
                website_id=website_id,
                site_path=site_path,
                entries=entries,
                progress=progress,
                stop_reason=stop_reason,
            )

            batch_urls = [entry.url for entry in batch_entries if entry.status == "pending"]
            crawl_results = []
            if batch_urls:
                crawl_audit_file = logs_dir / "crawl_audit.jsonl"
                logger.info("Crawl batch started batch=%s urls=%s", batch_number, len(batch_urls))
                crawl_results = crawl_urls(
                    batch_urls,
                    output_dir=html_dir,
                    workers=1,
                    audit_file=crawl_audit_file,
                    manifest_file=None,
                    logs_dir=logs_dir,
                )
                logger.info("Crawl batch completed batch=%s results=%s", batch_number, len(crawl_results))

            batch_source_paths: list[Path] = []
            for result in crawl_results:
                entry = next((item for item in batch_entries if item.url == result.url), None)
                if entry is None:
                    continue
                if result.success and result.output_path:
                    update_registry_entry(
                        entries,
                        entry.url,
                        status="crawled",
                        batch_index=batch_number,
                        output_path=str(result.output_path),
                        crawled_at=_utc_now(),
                    )
                    batch_source_paths.append(Path(result.output_path))
                else:
                    update_registry_entry(
                        entries,
                        entry.url,
                        status="failed",
                        batch_index=batch_number,
                        error=result.error or result.status,
                    )

            for entry in batch_entries:
                if entry.status in {"crawled", "processed"} and entry.output_path:
                    batch_source_paths.append(Path(entry.output_path))

            unique_batch_source_paths: list[Path] = []
            seen_source_paths: set[str] = set()
            for path in batch_source_paths:
                resolved = str(path.resolve())
                if resolved in seen_source_paths or not path.exists():
                    continue
                seen_source_paths.add(resolved)
                unique_batch_source_paths.append(path)
            batch_source_paths = unique_batch_source_paths
            if not batch_source_paths:
                progress.last_completed_batch = batch_number
                _mark_batch_completion(
                    website_id=website_id,
                    site_path=site_path,
                    entries=entries,
                    progress=progress,
                    stop_reason=stop_reason,
                )
                continue

            batch_result: BatchProcessingResult = process_raw_html_files(
                batch_source_paths,
                output_base_dir=site_path,
                chunking=chunking if isinstance(chunking, dict) else None,
                seen_hashes=seen_hashes,
                seen_fingerprints=seen_fingerprints,
                seen_chunk_hashes=seen_chunk_hashes,
            )
            logger.info(
                "Batch processing completed batch=%s processed=%s exported_chunks=%s",
                batch_number,
                batch_result.summary.processed_documents,
                batch_result.summary.exported_chunks,
            )

            if batch_result.chunk_records:
                index_summary = index_chunk_records(
                    batch_result.chunk_records,
                    chroma_dir=vector_dir,
                    collection_name=CHROMA_COLLECTION,
                )
                logger.info(
                    "Batch indexing completed batch=%s loaded=%s indexed=%s",
                    batch_number,
                    index_summary.loaded_chunks,
                    index_summary.indexed_chunks,
                )

            for entry in batch_entries:
                if entry.status in {"failed", "indexed"}:
                    continue
                if entry.output_path and Path(entry.output_path).exists():
                    update_registry_entry(
                        entries,
                        entry.url,
                        status="processed",
                        batch_index=batch_number,
                        processed_at=_utc_now(),
                    )
                    update_registry_entry(
                        entries,
                        entry.url,
                        status="indexed",
                        batch_index=batch_number,
                        indexed_at=_utc_now(),
                    )
                elif entry.status == "pending":
                    update_registry_entry(entries, entry.url, status="failed", batch_index=batch_number, error="Missing raw html output")

            progress.last_completed_batch = batch_number
            progress.status = "partially_ready"
            _mark_batch_completion(
                website_id=website_id,
                site_path=site_path,
                entries=entries,
                progress=progress,
                stop_reason=stop_reason,
            )

            if is_pause_requested(site_path):
                progress.status = "paused"
                _mark_batch_completion(
                    website_id=website_id,
                    site_path=site_path,
                    entries=entries,
                    progress=progress,
                    stop_reason=stop_reason,
                )
                logger.info("Pause requested after batch %s", batch_number)
                return _final_response(website_id, progress, entries, stop_reason, logger)

        if progress.indexed_urls > 0 and progress.failed_urls == 0 and progress.pending_urls == 0:
            progress.status = "ready"
        elif progress.indexed_urls > 0:
            progress.status = "partially_ready"
        else:
            progress.status = "failed"

        _mark_batch_completion(
            website_id=website_id,
            site_path=site_path,
            entries=entries,
            progress=progress,
            stop_reason=stop_reason,
        )

        logger.info(
            "Ingest completed website_id=%s indexed_urls=%s failed_urls=%s status=%s",
            website_id,
            progress.indexed_urls,
            progress.failed_urls,
            progress.status,
        )
        return _final_response(website_id, progress, entries, stop_reason, logger)
    except Exception as exc:
        logger.exception("Ingest failed website_id=%s error=%s", website_id, exc)
        update_metadata(website_id, {"status": "failed", "error": str(exc), "ingestion_pid": os.getpid()})
        update_context_status(website_id, "failed", error=str(exc), ingestion_pid=os.getpid())
        try:
            log_path = logs_dir / "ingest_error.log"
            log_path.write_text(traceback.format_exc(), encoding="utf-8")
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
    summary = {
        "total_urls": progress.total_urls,
        "pending_urls": progress.pending_urls,
        "processed_urls": progress.processed_urls,
        "indexed_urls": progress.indexed_urls,
        "failed_urls": progress.failed_urls,
        "current_batch": progress.current_batch,
        "total_batches": progress.total_batches,
        "last_completed_batch": progress.last_completed_batch,
        "status": progress.status,
        "stop_reason": stop_reason,
    }
    try:
        summary["registry"] = [entry.to_dict() for entry in entries]
    except Exception:
        summary["registry"] = []
    return {"id": website_id, "status": progress.status, "summary": summary}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def urlparse_host(seed_url: str) -> str:
    from urllib.parse import urlparse

    return urlparse(seed_url).netloc or seed_url
