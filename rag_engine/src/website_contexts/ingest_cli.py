"""CLI entrypoint for background website ingestion."""

from __future__ import annotations

import sys

from src.website_contexts.website_manager import website_path
from src.website_contexts.website_ingestor import ingest_website


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python -m src.website_contexts.ingest_cli <website_id> <seed_url>", file=sys.stderr)
        return 2

    website_id = sys.argv[1].strip()
    seed_url = sys.argv[2].strip()
    output_dir = website_path(website_id)
    ingest_website(seed_url, website_id, output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
