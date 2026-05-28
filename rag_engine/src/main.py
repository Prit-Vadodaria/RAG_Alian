"""src-first entrypoint wrapper.

Keeps existing CLI behavior by delegating to the current root main module.
"""

from __future__ import annotations

from main import main


if __name__ == "__main__":
    main()
