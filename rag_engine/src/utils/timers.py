"""Small timing helpers."""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator


@contextmanager
def time_block() -> Iterator[callable]:
    start = time.perf_counter()
    elapsed = lambda: time.perf_counter() - start
    yield elapsed
