"""CLI runner to perform website ingestion for a given context id.

Usage: python src/website_contexts/ingest_cli.py <context_id> <name> <url>
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.website_contexts.website_ingestor import ingest_website


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print("Usage: ingest_cli.py <context_id> <name> <url>")
        return 2
    _, context_id, name, url = argv[:4]
    ingest_website(context_id, name, url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
