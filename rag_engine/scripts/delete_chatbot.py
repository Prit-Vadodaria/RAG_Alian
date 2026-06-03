"""Delete chatbot-scoped vectors from the shared chatbot collection."""

from __future__ import annotations

import argparse
from pathlib import Path

from src.config.settings import BASE_DIR, CHATBOT_CHROMA_COLLECTION
from src.vectordb.chroma_store import ChromaStore


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chatbot-id", required=True)
    parser.add_argument("--namespace", required=True)
    parser.add_argument(
        "--context-id",
        action="append",
        required=True,
        help="Context id whose chatbot vectors should be removed. Repeat for multiple contexts.",
    )
    parser.add_argument("--collection-name", default=CHATBOT_CHROMA_COLLECTION)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    for context_id in args.context_id:
        chroma_dir = BASE_DIR / "websites" / context_id / "embeddings"
        store = ChromaStore(chroma_dir=Path(chroma_dir), collection_name=args.collection_name)
        try:
            store.delete_where(
                {
                    "$and": [
                        {"chatbot_id": {"$eq": args.chatbot_id}},
                        {"namespace": {"$eq": args.namespace}},
                    ]
                }
            )
        except Exception:
            # Best-effort cleanup. The chatbot record deletion should not fail just
            # because vector pruning had a transient issue.
            pass

        print(
            f"Deleted chatbot vectors for chatbot_id={args.chatbot_id} "
            f"namespace={args.namespace} context_id={context_id} collection={args.collection_name}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
