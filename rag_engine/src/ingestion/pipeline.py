"""Post-HTML processing pipeline.

Changes from original:
- Duplicate detection now compares extracted main content (markdown),
  not full raw HTML. Template/nav/footer similarity no longer causes
  false-positive dedup (issue #1).
- Jaccard threshold is read from settings.DUPLICATE_SIMILARITY_THRESHOLD
  (configurable via env var) instead of being hardcoded at 0.92 (issue #1).
- Skip reason logged for every skipped-duplicate page (issue #1).
- Minimum content length read from settings.MIN_CONTENT_LENGTH (issue #1).
- Structured entity extraction (JSON-LD, product schema, meta tags)
  injected into chunk metadata before chunking (issues #5, #6).
"""

from __future__ import annotations

import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from functools import partial
from pathlib import Path

from src.chunking.chunker import build_chunks
from src.config.settings import (
    CLEANED_MARKDOWN_DIR,
    DUPLICATE_SIMILARITY_THRESHOLD,
    LOGS_DIR,
    MIN_CONTENT_LENGTH,
    RAW_HTML_DIR,
    STRUCTURED_DOCS_DIR,
    CHUNKS_DIR,
    ensure_directories,
)
from src.ingestion.cleaner import extract_main_content
from src.ingestion.entity_extractor import extract_structured_entities
from src.ingestion.scraper import html_to_markdown
from src.ingestion.parser import extract_metadata
from src.utils.hashing import content_hash, jaccard_similarity, shingle_fingerprint
from src.utils.logging import close_logger, get_logger
from src.vectordb.chroma_store import ChunkRecord


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


@dataclass(frozen=True)
class BatchProcessingResult:
    """Results for one ingestion batch."""

    summary: ProcessingSummary
    chunk_records: list[ChunkRecord]
    processed_document_ids: list[str]


def discover_raw_html_files(input_dir: Path | None = None) -> list[Path]:
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
    ensure_directories()
    cleaned_dir = CLEANED_MARKDOWN_DIR if output_base_dir is None else (output_base_dir / "cleaned_markdown")
    structured_dir = STRUCTURED_DOCS_DIR if output_base_dir is None else (output_base_dir / "structured_docs")
    chunks_dir = CHUNKS_DIR if output_base_dir is None else (output_base_dir / "chunks")
    logs_dir = LOGS_DIR if output_base_dir is None else (output_base_dir / "logs")

    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = get_logger("html_processor", logs_dir / "html_processing.log")
    files = discover_raw_html_files(input_dir)
    selected_files = files[:limit] if limit is not None else files
    resolved_chunking = _resolve_chunking_config(chunking)
    logger.info(
        "HTML processing started files=%s workers=%s output_base_dir=%s chunking=%s dedup_threshold=%s",
        len(selected_files),
        workers,
        output_base_dir,
        resolved_chunking,
        DUPLICATE_SIMILARITY_THRESHOLD,
    )

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
                logger.warning("Skipped empty page %s (content below min_length=%s)", result.source_path, MIN_CONTENT_LENGTH)
                continue

            document = result.document
            fingerprint = shingle_fingerprint(document.markdown)

            # Issue #1: compare extracted markdown (main content) not raw HTML.
            # Issue #1: configurable threshold, logged skip reason.
            dup_reason = _check_duplicate(document.document_hash, fingerprint, seen_hashes, seen_fingerprints)
            if dup_reason:
                skipped_duplicates += 1
                logger.info(
                    "Skipped duplicate page %s reason=%s hash=%s",
                    result.source_path,
                    dup_reason,
                    document.document_hash[:12],
                )
                continue

            seen_hashes.add(document.document_hash)
            seen_fingerprints.append(fingerprint)
            _export_document(document, cleaned_dir=cleaned_dir, structured_dir=structured_dir)

            unique_chunks = _dedupe_chunks(result.chunks, seen_chunk_hashes)
            _export_chunks(document.document_id, unique_chunks, chunks_dir=chunks_dir)
            exported_chunks += len(unique_chunks)
            processed_documents += 1
            logger.info("Document %s exported_chunks=%s", document.document_id, len(unique_chunks))

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
        logger.info(
            "HTML processing finished processed=%s skipped_duplicates=%s empty_pages=%s failed_pages=%s exported_chunks=%s",
            processed_documents,
            skipped_duplicates,
            empty_pages,
            failed_pages,
            exported_chunks,
        )
        close_logger(logger)


def process_raw_html_files(
    source_paths: list[Path],
    *,
    output_base_dir: Path | None = None,
    chunking: dict[str, object] | None = None,
    seen_hashes: set[str] | None = None,
    seen_fingerprints: list[set[str]] | None = None,
    seen_chunk_hashes: set[str] | None = None,
) -> BatchProcessingResult:
    ensure_directories()
    cleaned_dir = CLEANED_MARKDOWN_DIR if output_base_dir is None else (output_base_dir / "cleaned_markdown")
    structured_dir = STRUCTURED_DOCS_DIR if output_base_dir is None else (output_base_dir / "structured_docs")
    chunks_dir = CHUNKS_DIR if output_base_dir is None else (output_base_dir / "chunks")
    logs_dir = LOGS_DIR if output_base_dir is None else (output_base_dir / "logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = get_logger("html_batch_processor", logs_dir / "html_batch_processing.log")
    resolved_chunking = _resolve_chunking_config(chunking)

    batch_seen_hashes = seen_hashes if seen_hashes is not None else set()
    batch_seen_fingerprints = seen_fingerprints if seen_fingerprints is not None else []
    batch_seen_chunk_hashes = seen_chunk_hashes if seen_chunk_hashes is not None else set()

    processed_documents = 0
    skipped_duplicates = 0
    empty_pages = 0
    failed_pages = 0
    exported_chunks = 0
    chunk_records: list[ChunkRecord] = []
    processed_document_ids: list[str] = []

    try:
        for source_path in sorted(source_paths):
            result = _process_html_file(source_path, chunking=resolved_chunking)
            if result.error:
                failed_pages += 1
                logger.error("Failed processing %s: %s", result.source_path, result.error)
                continue

            if result.empty or result.document is None:
                empty_pages += 1
                logger.warning("Skipped empty page %s (min_length=%s)", result.source_path, MIN_CONTENT_LENGTH)
                continue

            document = result.document
            fingerprint = shingle_fingerprint(document.markdown)

            # Issue #1: compare main content, configurable threshold, log reason.
            dup_reason = _check_duplicate(
                document.document_hash, fingerprint,
                batch_seen_hashes, batch_seen_fingerprints,
            )
            if dup_reason:
                skipped_duplicates += 1
                logger.info(
                    "Skipped duplicate page %s reason=%s hash=%s",
                    result.source_path,
                    dup_reason,
                    document.document_hash[:12],
                )
                continue

            batch_seen_hashes.add(document.document_hash)
            batch_seen_fingerprints.append(fingerprint)
            _export_document(document, cleaned_dir=cleaned_dir, structured_dir=structured_dir)

            unique_chunks = _dedupe_chunks(result.chunks, batch_seen_chunk_hashes)
            _export_chunks(document.document_id, unique_chunks, chunks_dir=chunks_dir)

            for chunk in unique_chunks:
                chunk_records.append(
                    ChunkRecord(
                        chunk_id=str(chunk.get("chunk_id", "")),
                        content=str(chunk.get("content", "")).strip(),
                        metadata={
                            key: value
                            for key, value in chunk.items()
                            if isinstance(value, (str, int, float, bool)) and value != ""
                        },
                    )
                )

            exported_chunks += len(unique_chunks)
            processed_documents += 1
            processed_document_ids.append(document.document_id)

        summary = ProcessingSummary(
            discovered_files=len(source_paths),
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
        return BatchProcessingResult(
            summary=summary,
            chunk_records=chunk_records,
            processed_document_ids=processed_document_ids,
        )
    finally:
        logger.info(
            "HTML batch processing finished processed=%s skipped_duplicates=%s empty_pages=%s failed_pages=%s exported_chunks=%s",
            processed_documents,
            skipped_duplicates,
            empty_pages,
            failed_pages,
            exported_chunks,
        )
        close_logger(logger)


def process_html_file(source_path: Path) -> ProcessedDocument:
    return _process_html_file(source_path, chunking=None)


def _process_html_file(source_path: Path, *, chunking: dict[str, int] | None) -> ProcessedDocument:
    try:
        raw_html = source_path.read_text(encoding="utf-8", errors="replace")
        extraction = extract_main_content(raw_html)
        if extraction.is_empty:
            return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], empty=True)

        markdown = html_to_markdown(extraction.html)
        if not markdown.strip():
            return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], empty=True)

        # Issues #5 & #6: extract structured entities and merge into metadata.
        base_metadata = extract_metadata(raw_html, extraction.html, source_path).to_dict()
        entities = extract_structured_entities(raw_html)
        merged_metadata = {**base_metadata, **entities}
        merged_metadata["source_file"] = str(source_path)

        document_hash = content_hash(markdown)
        document_id = source_path.stem

        document = StructuredDocument(
            document_id=document_id,
            document_hash=document_hash,
            source_file=str(source_path),
            extraction_method=extraction.method,
            metadata=merged_metadata,
            markdown=markdown,
        )
        chunks = [
            chunk.to_dict()
            for chunk in build_chunks(
                markdown,
                metadata=merged_metadata,
                document_hash=document_hash,
                max_tokens=chunking["max_tokens"] if chunking else None,
                min_tokens=chunking["min_tokens"] if chunking else None,
                overlap_tokens=chunking["overlap_tokens"] if chunking else None,
            )
        ]
        return ProcessedDocument(source_path=str(source_path), document=document, chunks=chunks)
    except Exception as exc:
        return ProcessedDocument(source_path=str(source_path), document=None, chunks=[], error=str(exc))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _check_duplicate(
    doc_hash: str,
    fingerprint: set[str],
    seen_hashes: set[str],
    seen_fingerprints: list[set[str]],
) -> str | None:
    """Return a reason string if the document is a duplicate, else None.

    Issue #1: threshold is configurable, reason is explicit.
    """
    if doc_hash in seen_hashes:
        return "exact_content_hash"
    for existing in seen_fingerprints:
        similarity = jaccard_similarity(fingerprint, existing)
        if similarity >= DUPLICATE_SIMILARITY_THRESHOLD:
            return f"near_duplicate_jaccard={similarity:.3f}_threshold={DUPLICATE_SIMILARITY_THRESHOLD}"
    return None


def _dedupe_chunks(
    chunks: list[dict[str, object]],
    seen_chunk_hashes: set[str],
) -> list[dict[str, object]]:
    unique: list[dict[str, object]] = []
    for chunk in chunks:
        h = content_hash(str(chunk.get("raw_content") or chunk.get("content", "")))
        if h in seen_chunk_hashes:
            continue
        seen_chunk_hashes.add(h)
        unique.append(chunk)
    return unique


def _process_files(files: list[Path], workers: int, *, chunking: dict[str, int]) -> list[ProcessedDocument]:
    if workers <= 1:
        return [_process_html_file(path, chunking=chunking) for path in files]
    results: list[ProcessedDocument] = []
    with ProcessPoolExecutor(max_workers=workers) as executor:
        worker = partial(_process_html_file, chunking=chunking)
        futures = {executor.submit(worker, path): path for path in files}
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda r: r.source_path)


def _export_document(document: StructuredDocument, *, cleaned_dir: Path, structured_dir: Path) -> None:
    cleaned_dir.mkdir(parents=True, exist_ok=True)
    structured_dir.mkdir(parents=True, exist_ok=True)
    (cleaned_dir / f"{document.document_id}.md").write_text(document.markdown, encoding="utf-8")
    (structured_dir / f"{document.document_id}.json").write_text(
        json.dumps(document.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _export_chunks(document_id: str, chunks: list[dict[str, object]], *, chunks_dir: Path) -> None:
    chunks_dir.mkdir(parents=True, exist_ok=True)
    (chunks_dir / f"{document_id}.chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8"
    )


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

    return {"max_tokens": max_tokens, "min_tokens": min_tokens, "overlap_tokens": overlap_tokens}