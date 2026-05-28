"""I/O helper utilities."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def read_text(path: Path, encoding: str = "utf-8") -> str:
    return path.read_text(encoding=encoding)


def write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding=encoding)


def read_json(path: Path) -> Any:
    return json.loads(read_text(path))


def write_json(path: Path, payload: Any, *, indent: int = 2) -> None:
    write_text(path, json.dumps(payload, ensure_ascii=False, indent=indent))
