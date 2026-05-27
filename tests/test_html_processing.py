"""Tests for post-HTML document processing."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.chunking.chunker import build_chunks, split_markdown_blocks
from src.ingestion.cleaner import extract_main_content
from src.ingestion.scraper import html_to_markdown
from src.ingestion.parser import extract_metadata
from src.ingestion.pipeline import process_html_file, process_raw_html_directory


HTML = """<!-- source_url: https://example.com/en/about -->
<!doctype html>
<html lang="en">
  <head>
    <title>About Example</title>
    <meta name="description" content="Example description">
    <link rel="canonical" href="https://example.com/en/about">
  </head>
  <body>
    <nav>Navigation noise</nav>
    <main>
      <h1>About Example</h1>
      <p>This is meaningful article content with enough text for extraction.</p>
      <h2>Services</h2>
      <ul><li>Automation</li><li>Analytics</li></ul>
      <pre><code>print("hello")</code></pre>
    </main>
    <footer>Footer noise</footer>
  </body>
</html>
"""


class HtmlProcessingTests(unittest.TestCase):
    def test_extract_main_content_removes_boilerplate(self) -> None:
        result = extract_main_content(HTML)

        self.assertFalse(result.is_empty)
        self.assertIn("About Example", result.html)
        self.assertNotIn("Navigation noise", result.html)
        self.assertNotIn("Footer noise", result.html)

    def test_html_to_markdown_preserves_structure(self) -> None:
        markdown = html_to_markdown("<main><h1>Title</h1><ul><li>One</li></ul></main>")

        self.assertIn("# Title", markdown)
        self.assertIn("- One", markdown)

    def test_extract_metadata_reads_common_fields(self) -> None:
        metadata = extract_metadata(HTML, HTML, Path("page.html"))

        self.assertEqual(metadata.title, "About Example")
        self.assertEqual(metadata.url, "https://example.com/en/about")
        self.assertEqual(metadata.canonical_url, "https://example.com/en/about")
        self.assertEqual(metadata.language, "en")
        self.assertIn("About Example", metadata.headings)

    def test_split_markdown_blocks_tracks_heading_paths(self) -> None:
        blocks = split_markdown_blocks("# Title\n\n## Section\n\nParagraph")

        self.assertEqual(blocks[-1].heading_path, ["Title", "Section"])

    def test_build_chunks_enriches_metadata(self) -> None:
        markdown = "# Title\n\n" + "\n\n".join(["Paragraph with useful retrieval content."] * 80)
        chunks = build_chunks(
            markdown,
            metadata={
                "url": "https://example.com/en/about",
                "title": "About Example",
                "source_file": "page.html",
            },
            document_hash="abc123",
            max_tokens=120,
            min_tokens=10,
            overlap_tokens=20,
        )

        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0].url, "https://example.com/en/about")
        self.assertTrue(chunks[0].chunk_id.startswith("abc123"))
        self.assertEqual(chunks[0].source_section, chunks[0].section)
        self.assertTrue(chunks[0].content_type)

    def test_build_chunks_splits_large_code_blocks_within_limit(self) -> None:
        markdown = "# API\n\n```python\n" + "\n".join([f"print('line {index}')" for index in range(80)]) + "\n```"

        chunks = build_chunks(
            markdown,
            metadata={"title": "API", "source_file": "page.html"},
            document_hash="abc123",
            max_tokens=80,
            min_tokens=10,
            overlap_tokens=10,
        )

        code_chunks = [chunk for chunk in chunks if chunk.content_type == "code"]
        self.assertGreater(len(code_chunks), 1)
        self.assertTrue(all(chunk.token_count <= 80 for chunk in chunks))
        self.assertTrue(all(chunk.parent_chunk_id for chunk in code_chunks))
        self.assertTrue(all(chunk.split_count == len(code_chunks) for chunk in code_chunks))

    def test_build_chunks_splits_large_tables_within_limit(self) -> None:
        rows = ["| Plan | Feature | Notes |", "| --- | --- | --- |"]
        rows.extend(f"| Sprint {index} | Feature {index} | Detailed note {index} |" for index in range(60))
        markdown = "# Pricing\n\n" + "\n".join(rows)

        chunks = build_chunks(
            markdown,
            metadata={"title": "Pricing", "source_file": "page.html"},
            document_hash="abc123",
            max_tokens=90,
            min_tokens=10,
            overlap_tokens=10,
        )

        table_chunks = [chunk for chunk in chunks if chunk.content_type == "table"]
        self.assertGreater(len(table_chunks), 1)
        self.assertTrue(all(chunk.token_count <= 90 for chunk in chunks))
        self.assertTrue(all("| Plan | Feature | Notes |" in chunk.content for chunk in table_chunks))

    def test_process_html_file_returns_document_and_chunks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            html_path = Path(temp_dir) / "page.html"
            html_path.write_text(HTML, encoding="utf-8")

            result = process_html_file(html_path)

            self.assertIsNone(result.error)
            self.assertIsNotNone(result.document)
            self.assertGreaterEqual(len(result.chunks), 1)

    def test_process_raw_html_directory_exports_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            raw_dir = root / "raw_html"
            markdown_dir = root / "cleaned_markdown"
            docs_dir = root / "structured_docs"
            chunks_dir = root / "chunks"
            logs_dir = root / "logs"
            raw_dir.mkdir()
            (raw_dir / "page.html").write_text(HTML, encoding="utf-8")

            with (
                patch("app.pipeline.html_processor.CLEANED_MARKDOWN_DIR", markdown_dir),
                patch("app.pipeline.html_processor.STRUCTURED_DOCS_DIR", docs_dir),
                patch("app.pipeline.html_processor.CHUNKS_DIR", chunks_dir),
                patch("app.pipeline.html_processor.LOGS_DIR", logs_dir),
            ):
                summary = process_raw_html_directory(input_dir=raw_dir)

            self.assertEqual(summary.processed_documents, 1)
            self.assertEqual(summary.failed_pages, 0)
            self.assertEqual(len(list(markdown_dir.glob("*.md"))), 1)
            self.assertEqual(len(list(docs_dir.glob("*.json"))), 1)
            chunk_files = list(chunks_dir.glob("*.json"))
            self.assertEqual(len(chunk_files), 1)
            self.assertGreaterEqual(len(json.loads(chunk_files[0].read_text(encoding="utf-8"))), 1)


if __name__ == "__main__":
    unittest.main()
