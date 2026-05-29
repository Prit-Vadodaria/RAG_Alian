"""CLI runner to perform website cleanup for a given context id.

Usage: python src/website_contexts/cleanup_cli.py <context_id>
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.website_contexts.website_cleanup import delete_website


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: cleanup_cli.py <context_id>")
        return 2
    _, context_id = argv[:2]
    delete_website(context_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
