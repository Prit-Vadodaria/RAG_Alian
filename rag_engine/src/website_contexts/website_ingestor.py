"""Minimal website ingestor scaffolding (crawl -> clean -> chunk -> embed).

This file intentionally provides a small, non-invasive orchestration wrapper
that can be expanded later. It does not alter existing ingestion pipelines.
"""

from __future__ import annotations

from typing import Any
from pathlib import Path
import traceback

from dataclasses import asdict
from src.website_contexts.website_manager import create_website_workspace, update_metadata
from src.ingestion.crawler import crawl_urls
from src.website_contexts.discoverer import discover_internal_urls
from src.ingestion.pipeline import process_raw_html_directory
from src.vectordb.chroma_store import index_exported_chunks


def ingest_website(context_id: str, name: str, url: str) -> dict[str, Any]:
    """Run full website ingestion for a website sandbox.

    Steps:
    - ensure workspace exists
    - crawl seed URL into websites/{context_id}/raw_html
    - run post-HTML pipeline writing outputs into the website sandbox
    - index exported chunks into website chroma DB
    - update metadata status accordingly
    """
    site_path = Path(__file__).resolve().parents[2] / "websites" / context_id
    create_website_workspace(context_id, name, url)
    update_metadata(context_id, {"status": "processing"})
    try:
        raw_html_dir = site_path / "raw_html"
        # Discover internal website URLs and crawl them
        discovered = discover_internal_urls(url)
        # Ensure root seed is present at front
        if not discovered or discovered[0] != url:
            discovered = [url] + [u for u in discovered if u != url]
        crawl_results = crawl_urls(discovered, output_dir=raw_html_dir, workers=1)
        pages_crawled = sum(1 for r in crawl_results if getattr(r, "success", False))
        update_metadata(context_id, {"pages_crawled": pages_crawled})

        # Process raw HTML into cleaned markdown, structured docs and chunks
        summary = process_raw_html_directory(input_dir=raw_html_dir, workers=1, output_base_dir=site_path)

        # Index exported chunks into website-specific chroma
        chunks_dir = site_path / "chunks"
        chroma_dir = site_path / "chroma"
        indexed = index_exported_chunks(chunks_dir=chunks_dir, chroma_dir=chroma_dir)

        # update metadata with results
        try:
            chunks_created = int(getattr(summary, "exported_chunks", 0))
        except Exception:
            chunks_created = 0
        update_metadata(context_id, {"status": "ready", "chunks_created": chunks_created})
        try:
            summary_obj = asdict(summary)
        except Exception:
            # fallback: build dict from attributes
            summary_obj = {
                "discovered_files": getattr(summary, "discovered_files", 0),
                "processed_documents": getattr(summary, "processed_documents", 0),
                "skipped_duplicates": getattr(summary, "skipped_duplicates", 0),
                "empty_pages": getattr(summary, "empty_pages", 0),
                "failed_pages": getattr(summary, "failed_pages", 0),
                "exported_chunks": getattr(summary, "exported_chunks", 0),
                "cleaned_markdown_dir": getattr(summary, "cleaned_markdown_dir", ""),
                "structured_docs_dir": getattr(summary, "structured_docs_dir", ""),
                "chunks_dir": getattr(summary, "chunks_dir", ""),
                "logs_dir": getattr(summary, "logs_dir", ""),
            }

        return {"id": context_id, "status": "ready", "summary": summary_obj}
    except Exception as exc:
        update_metadata(context_id, {"status": "failed", "error": str(exc)})
        # record traceback into a log file inside site sandbox
        try:
            log_path = site_path / "logs" / "ingest_error.log"
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.write_text(traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass
        raise
