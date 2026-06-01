"""CLI entrypoint for background website deletion."""

from __future__ import annotations

import sys

from src.website_contexts.website_cleanup import delete_website_context


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m src.website_contexts.cleanup_cli <website_id>", file=sys.stderr)
        return 2

    delete_website_context(sys.argv[1].strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
