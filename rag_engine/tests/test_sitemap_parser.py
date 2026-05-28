"""Tests for Phase 1 sitemap ingestion."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from requests import RequestException

from src.ingestion.sitemap import (
    filter_urls_by_language,
    is_valid_url,
    parse_and_save_sitemap,
    parse_sitemap,
    save_urls,
)


class SitemapParserTests(unittest.TestCase):
    def test_is_valid_url_accepts_http_urls(self) -> None:
        self.assertTrue(is_valid_url("https://example.com/page"))
        self.assertTrue(is_valid_url("http://example.com/page"))

    def test_is_valid_url_rejects_relative_and_non_http_urls(self) -> None:
        self.assertFalse(is_valid_url("/page"))
        self.assertFalse(is_valid_url("mailto:test@example.com"))

    def test_filter_urls_by_language_keeps_requested_language(self) -> None:
        urls = [
            "https://example.com/en",
            "https://example.com/en/about",
            "https://example.com/blog/hiring-for-production-ai",
            "https://example.com/hi",
            "https://example.com/hi/about",
        ]

        self.assertEqual(
            filter_urls_by_language(urls, "en"),
            ["https://example.com/en", "https://example.com/en/about"],
        )

    @patch("src.ingestion.sitemap.requests.get")
    def test_parse_sitemap_extracts_unique_valid_urls(self, mock_get: Mock) -> None:
        mock_get.return_value = Mock(
            content=b"""
            <urlset>
                <url><loc>https://example.com/a</loc></url>
                <url><loc>https://example.com/a</loc></url>
                <url><loc>/relative</loc></url>
                <url><loc>https://example.com/b</loc></url>
            </urlset>
            """,
            raise_for_status=Mock(),
        )

        self.assertEqual(
            parse_sitemap("https://example.com/sitemap.xml", visited=set()),
            ["https://example.com/a", "https://example.com/b"],
        )

    @patch("src.ingestion.sitemap.requests.get")
    def test_parse_sitemap_traverses_nested_sitemaps(self, mock_get: Mock) -> None:
        responses = {
            "https://example.com/sitemap.xml": b"""
            <sitemapindex>
                <sitemap><loc>https://example.com/posts.xml</loc></sitemap>
            </sitemapindex>
            """,
            "https://example.com/posts.xml": b"""
            <urlset>
                <url><loc>https://example.com/post-1</loc></url>
            </urlset>
            """,
        }

        def fake_get(url: str, timeout: int) -> Mock:
            return Mock(content=responses[url], raise_for_status=Mock())

        mock_get.side_effect = fake_get

        self.assertEqual(
            parse_sitemap("https://example.com/sitemap.xml", visited=set()),
            ["https://example.com/post-1"],
        )

    @patch("src.ingestion.sitemap.get_logger")
    @patch("src.ingestion.sitemap.requests.get")
    def test_parse_sitemap_handles_request_failure(self, mock_get: Mock, get_logger: Mock) -> None:
        logger = Mock()
        get_logger.return_value = logger
        mock_get.side_effect = RequestException("network failure")

        self.assertEqual(parse_sitemap("https://example.com/sitemap.xml", visited=set()), [])
        logger.warning.assert_called_once()

    def test_save_urls_persists_unique_urls(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "urls.txt"
            save_urls(["https://example.com/a", "https://example.com/a"], output_path)

            self.assertEqual(output_path.read_text(encoding="utf-8"), "https://example.com/a\n")

    @patch("src.ingestion.sitemap.requests.get")
    def test_parse_and_save_sitemap_writes_output(self, mock_get: Mock) -> None:
        mock_get.return_value = Mock(
            content=b"<urlset><url><loc>https://example.com/en/a</loc></url></urlset>",
            raise_for_status=Mock(),
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "urls.txt"
            urls = parse_and_save_sitemap(
                "https://example.com/sitemap.xml",
                output_path=output_path,
                language="en",
            )

            self.assertEqual(urls, ["https://example.com/en/a"])
            self.assertEqual(output_path.read_text(encoding="utf-8"), "https://example.com/en/a\n")


if __name__ == "__main__":
    unittest.main()
