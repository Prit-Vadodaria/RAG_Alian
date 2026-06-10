"""Tests for website ingestion completion state transitions."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.website_contexts.ingestion_registry import IngestionProgress, RegistryEntry
from src.website_contexts.website_ingestor import _update_progress_metadata


class WebsiteIngestorStatusTests(unittest.TestCase):
    def test_completed_ingestion_with_some_failed_urls_becomes_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_path = Path(temp_dir)
            entries = [
                RegistryEntry(url="https://example.com/a", status="indexed", batch_index=1),
                RegistryEntry(url="https://example.com/b", status="failed", batch_index=1),
            ]
            progress = IngestionProgress(context_id="ctx", seed_url="https://example.com", status="partially_ready")

            with patch("src.website_contexts.website_ingestor.load_metadata", return_value={}), patch(
                "src.website_contexts.website_ingestor.update_metadata"
            ) as update_metadata, patch(
                "src.website_contexts.website_ingestor.update_context_status"
            ) as update_context_status:
                _update_progress_metadata(
                    "ctx",
                    site_path=site_path,
                    entries=entries,
                    progress=progress,
                    stop_reason=None,
                )

            self.assertEqual(progress.status, "ready")
            update_metadata.assert_called_once()
            update_context_status.assert_called_once()
            self.assertEqual(update_context_status.call_args.args[1], "ready")


if __name__ == "__main__":
    unittest.main()
