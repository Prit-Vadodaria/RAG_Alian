"""Post-HTML processing pipeline.

The pipeline converts raw rendered HTML files into cleaned markdown,
structured document JSON, and retrieval-ready chunk JSON files.
"""

from __future__ import annotations

import json
from functools import partial
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path

from src.chunking.chunker import build_chunks
from src.config.settings import (
    CLEANED_MARKDOWN_DIR,
    LOGS_DIR,
    RAW_HTML_DIR,
    STRUCTURED_DOCS_DIR,
    CHUNKS_DIR,
    ensure_directories,
)
from src.ingestion.cleaner import extract_main_content
from src.ingestion.scraper import html_to_markdown
from src.ingestion.parser import extract_metadata
from src.utils.hashing import content_hash, jaccard_similarity, shingle_fingerprint
from src.utils.logging import close_logger, get_logger


@dataclass(frozen=True)
class StructuredDocument:
    """Clean, structured document ready for chunking and later embedding."""

    document_id: str
    document_hash: str
    source_file: str
    extraction_method: str
    metadata: dict[str, object]
    markdown: str

    def to_dict(self) -> dict[str, object]:
        """Serialize the document for JSON export."""
        return asdict(self)


@dataclass(frozen=True)
class ProcessedDocument:
    """Intermediate result produced by a worker."""

    source_path: str
    document: StructuredDocument | None
    chunks: list[dict[str, object]]
    error: str | None = None
    empty: bool = False


@dataclass(frozen=True)
class ProcessingSummary:
    """Summary of a post-HTML processing run."""

    discovered_files: int
    processed_documents: int
    skipped_duplicates: int
    empty_pages: int
    failed_pages: int
    exported_chunks: int
    cleaned_markdown_dir: str
    structured_docs_dir: str
    chunks_dir: str
    logs_dir: str


def discover_raw_html_files(input_dir: Path | None = None) -> list[Path]:
    """Find raw HTML files in the canonical Phase 3 input directory."""
    if input_dir is not None:
        return sorted(input_dir.glob("*.html"))

    return sorted(RAW_HTML_DIR.glob("*.html"))


def process_raw_html_directory(
    *,
    input_dir: Path | None = None,
    limit: int | None = None,
    workers: int = 1,
    output_base_dir: Path | None = None,
    chunking: dict[str, object] | None = None,
) -> ProcessingSummary:
    """Process raw HTML files into markdown, document JSON, and chunk JSON."""
    ensure_directories()
    # choose target dirs: if output_base_dir is provided, write outputs there
    cleaned_dir = CLEANED_MARKDOWN_DIR if output_base_dir is None else (output_base_dir / "cleaned_markdown")
    structured_dir = STRUCTURED_DOCS_DIR if output_base_dir is None else (output_base_dir / "structured_docs")
    chunks_dir = CHUNKS_DIR if output_base_dir is None else (output_base_dir / "chunks")
    logs_dir = LOGS_DIR if output_base_dir is None else (output_base_dir / "logs")

    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = get_logger("html_processor", logs_dir / "html_processing.log")
    files = discover_raw_html_files(input_dir)
    selected_files = files[:limit] if limit is not None else files
    resolved_chunking = _resolve_chunking_config(chunking)

    processed = _process_files(selected_files, workers, chunking=resolved_chunking)
    seen_hashes: set[str] = set()
    seen_fingerprints: list[set[str]] = []
    seen_chunk_hashes: set[str] = set()
    skipped_duplicates = 0
    empty_pages = 0
    failed_pages = 0
    exported_chunks = 0
    processed_documents = 0

    try:
        for result in processed:
            if result.error:
                failed_pages += 1
                logger.error("Failed processing %s: %s", result.source_path, result.error)
                continue

            if result.empty or result.document is None:
                empty_pages += 1
                logger.warning("Skipped empty page %s", result.source_path)
                continue

            document = result.document
            fingerprint = shingle_fingerprint(document.markdown)
            is_near_duplicate = any(
                jaccard_similarity(fingerprint, existing) >= 0.92 for existing in seen_fingerprints
            )

            if document.document_hash in seen_hashes or is_near_duplicate:
                skipped_duplicates += 1
                logger.info("Skipped duplicate page %s", result.source_path)
                continue

            seen_hashes.add(document.document_hash)
            seen_fingerprints.append(fingerprint)
            _export_document(document, cleaned_dir=cleaned_dir, structured_dir=structured_dir)

            unique_chunks = []
            for chunk in result.chunks:
                chunk_hash = content_hash(str(chunk.get("raw_content") or chunk.get("content", "")))
                if chunk_hash in seen_chunk_hashes:
                    continue
                seen_chunk_hashes.add(chunk_hash)
                unique_chunks.append(chunk)

            _export_chunks(document.document_id, unique_chunks, chunks_dir=chunks_dir)
            exported_chunks += len(unique_chunks)
            processed_documents += 1
        return ProcessingSummary(
            discovered_files=len(selected_files),
            processed_documents=processed_documents,
            skipped_duplicates=skipped_duplicates,
            empty_pages=empty_pages,
            failed_pages=failed_pages,
            exported_chunks=exported_chunks,
            cleaned_markdown_dir=str(cleaned_dir),
            structured_docs_dir=str(structured_dir),
            chunks_dir=str(chunks_dir),
            logs_dir=str(logs_dir),
        )
    finally:
        close_logger(logger)


def process_html_file(source_path: Path) -> ProcessedDocument:
    """Process one raw HTML file into a structured document and chunks."""
    return _process_html_file(source_path, chunking=None)


def _process_html_file(source_path: Path, *, chunking: dict[str, int] | None) -> ProcessedDocument:
    """Process one raw HTML file into a structured document and chunks."""
    try:
        raw_html = source_path.read_text(encoding="utf-8", errors="replace")
        extraction = extract_main_content(raw_html)
        if extraction.is_empty:
            return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], empty=True)

        markdown = html_to_markdown(extraction.html)
        if not markdown.strip():
            return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], empty=True)

        metadata = extract_metadata(raw_html, extraction.html, source_path).to_dict()
        document_hash = content_hash(markdown)
        document_id = source_path.stem
        metadata["source_file"] = str(source_path)

        document = StructuredDocument(
            document_id=document_id,
            document_hash=document_hash,
            source_file=str(source_path),
            extraction_method=extraction.method,
            metadata=metadata,
            markdown=markdown,
        )
        chunks = [
            chunk.to_dict()
            for chunk in build_chunks(
                markdown,
                metadata=metadata,
                document_hash=document_hash,
                max_tokens=chunking["max_tokens"] if chunking else None,
                min_tokens=chunking["min_tokens"] if chunking else None,
                overlap_tokens=chunking["overlap_tokens"] if chunking else None,
            )
        ]

        return ProcessedDocument(source_path=str(source_path), document=document, chunks=chunks)
    except Exception as exc:
        return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], error=str(exc))


def _process_files(files: list[Path], workers: int, *, chunking: dict[str, int]) -> list[ProcessedDocument]:
    if workers <= 1:
        return [_process_html_file(path, chunking=chunking) for path in files]

    results: list[ProcessedDocument] = []
    with ProcessPoolExecutor(max_workers=workers) as executor:
        worker = partial(_process_html_file, chunking=chunking)
        futures = {executor.submit(worker, path): path for path in files}
        for future in as_completed(futures):
            results.append(future.result())

    return sorted(results, key=lambda result: result.source_path)


def _export_document(document: StructuredDocument, *, cleaned_dir: Path, structured_dir: Path) -> None:
    cleaned_dir.mkdir(parents=True, exist_ok=True)
    structured_dir.mkdir(parents=True, exist_ok=True)

    markdown_path = cleaned_dir / f"{document.document_id}.md"
    doc_path = structured_dir / f"{document.document_id}.json"

    markdown_path.write_text(document.markdown, encoding="utf-8")
    doc_path.write_text(
        json.dumps(document.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _export_chunks(document_id: str, chunks: list[dict[str, object]], *, chunks_dir: Path) -> None:
    chunks_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = chunks_dir / f"{document_id}.chunks.json"
    chunk_path.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")


def _resolve_chunking_config(chunking: dict[str, object] | None) -> dict[str, int]:
    from src.config.settings import CHUNK_OVERLAP_TOKENS, MAX_CHUNK_TOKENS, MIN_CHUNK_TOKENS

    config = dict(chunking or {})

    def _coerce(name: str, default: int) -> int:
        value = config.get(name)
        if isinstance(value, bool):
            value = None
        try:
            return int(value) if value is not None and str(value).strip() != "" else default
        except (TypeError, ValueError):
            return default

    max_tokens = max(100, _coerce("maxChunkTokens", MAX_CHUNK_TOKENS))
    min_tokens = max(20, _coerce("minChunkTokens", MIN_CHUNK_TOKENS))
    overlap_tokens = max(0, _coerce("chunkOverlapTokens", CHUNK_OVERLAP_TOKENS))

    if min_tokens >= max_tokens:
        min_tokens = max(20, max_tokens - 1)
    if overlap_tokens >= max_tokens:
        overlap_tokens = max(0, max_tokens - 1)

    return {
        "max_tokens": max_tokens,
        "min_tokens": min_tokens,
        "overlap_tokens": overlap_tokens,
    }
