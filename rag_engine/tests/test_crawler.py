"""Tests for Phase 2 crawler utilities."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src.ingestion.crawler import crawl_urls, load_crawl_manifest, output_path_for_url, read_urls, save_raw_html


class FakeCrawler:
    def crawl_page_with_retries(self, url: str) -> str:
        body = (
            f"{url} content for testing. "
            "This is a sufficiently long English paragraph used to validate the crawler output. "
            "It contains enough meaningful text to pass the minimum text threshold. "
        ) * 4
        return f"<html lang='en'><head><title>Test</title></head><body><main><p>{body}</p></main></body></html>"


class CrawlerTests(unittest.TestCase):
    def test_read_urls_returns_non_empty_lines(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            url_file = Path(temp_dir) / "urls.txt"
            url_file.write_text("https://example.com/a\n\nhttps://example.com/b\n", encoding="utf-8")

            self.assertEqual(read_urls(url_file), ["https://example.com/a", "https://example.com/b"])

    def test_output_path_for_url_is_stable_and_html(self) -> None:
        first_path = output_path_for_url("https://example.com/en/about")
        second_path = output_path_for_url("https://example.com/en/about")

        self.assertEqual(first_path, second_path)
        self.assertEqual(first_path.suffix, ".html")

    def test_save_raw_html_writes_source_url_comment(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = save_raw_html(
                "https://example.com/en/about",
                "<html lang='en'><head><title>About</title></head><body><main><p>"
                + (
                    "Valid content for testing. "
                    "This paragraph is long enough to pass validation and demonstrates a real rendered page. "
                    * 4
                )
                + "</p></main></body></html>",
                Path(temp_dir),
            )

            content = output_path.read_text(encoding="utf-8")
            self.assertIn("source_url: https://example.com/en/about", content)
            self.assertIn("lang=", content)

    def test_save_raw_html_accepts_missing_lang_with_english_text(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = save_raw_html(
                "https://example.com/about",
                "<html><head><title>About</title></head><body><main><p>"
                + (
                    "This page contains clear English content for the crawler to validate. "
                    "It does not depend on an html lang attribute, but the body text is still meaningful. "
                    * 4
                )
                + "</p></main></body></html>",
                Path(temp_dir),
            )

            self.assertTrue(output_path.exists())

    def test_crawl_urls_saves_html_with_injected_crawler(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            results = crawl_urls(
                ["https://example.com/en/a", "https://example.com/en/b"],
                output_dir=Path(temp_dir),
                crawler=FakeCrawler(),
                respect_robots=False,
                audit_file=None,
                manifest_file=None,
            )

            self.assertEqual(len(results), 2)
            self.assertTrue(all(result.success for result in results))
            self.assertTrue(all(result.output_path and result.output_path.exists() for result in results))

    def test_crawl_urls_respects_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            results = crawl_urls(
                ["https://example.com/en/a", "https://example.com/en/b"],
                output_dir=Path(temp_dir),
                limit=1,
                crawler=FakeCrawler(),
                respect_robots=False,
                audit_file=None,
                manifest_file=None,
            )

            self.assertEqual(len(results), 1)

    def test_crawl_urls_blocks_disallowed_domains(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            results = crawl_urls(
                ["https://evil.com/en/a"],
                output_dir=Path(temp_dir),
                crawler=FakeCrawler(),
                allowed_domains=["example.com"],
                respect_robots=False,
                audit_file=None,
                manifest_file=None,
            )

            self.assertEqual(len(results), 1)
            self.assertFalse(results[0].success)
            self.assertEqual(results[0].status, "blocked_domain")

    @patch("app.crawler.crawler.robotparser.RobotFileParser")
    def test_crawl_urls_blocks_robots_disallowed_urls(self, robot_parser: Mock) -> None:
        robots = Mock()
        robots.can_fetch.return_value = False
        robot_parser.return_value = robots

        with tempfile.TemporaryDirectory() as temp_dir:
            results = crawl_urls(
                ["https://example.com/private"],
                output_dir=Path(temp_dir),
                crawler=FakeCrawler(),
                respect_robots=True,
                audit_file=None,
                manifest_file=None,
            )

            self.assertEqual(results[0].status, "blocked_robots")
            self.assertFalse(results[0].success)

    def test_crawl_urls_writes_audit_records(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            audit_file = root / "crawl_audit.jsonl"

            results = crawl_urls(
                ["https://example.com/en/a"],
                output_dir=root,
                crawler=FakeCrawler(),
                respect_robots=False,
                audit_file=audit_file,
                manifest_file=None,
            )

            self.assertTrue(results[0].success)
            records = [json.loads(line) for line in audit_file.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(records[0]["url"], "https://example.com/en/a")
            self.assertEqual(records[0]["status"], "success")

    def test_crawl_urls_updates_manifest_and_tombstones_missing_urls(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            manifest_file = root / "crawl_manifest.json"

            crawl_urls(
                ["https://example.com/en/a", "https://example.com/en/b"],
                output_dir=root,
                crawler=FakeCrawler(),
                respect_robots=False,
                audit_file=None,
                manifest_file=manifest_file,
            )
            crawl_urls(
                ["https://example.com/en/a"],
                output_dir=root,
                crawler=FakeCrawler(),
                respect_robots=False,
                audit_file=None,
                manifest_file=manifest_file,
            )

            manifest = load_crawl_manifest(manifest_file)
            self.assertEqual(manifest["https://example.com/en/a"].status, "success")
            self.assertEqual(manifest["https://example.com/en/b"].status, "tombstoned")
            self.assertIsNotNone(manifest["https://example.com/en/b"].tombstoned_at)


if __name__ == "__main__":
    unittest.main()
