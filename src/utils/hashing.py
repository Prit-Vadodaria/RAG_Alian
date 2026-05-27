"""Hashing and deduplication helpers."""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable


def normalize_text(text: str) -> str:
    lowered = text.lower()
    no_space = re.sub(r"\s+", " ", lowered)
    return no_space.strip()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def content_hash(text: str) -> str:
    return sha256_text(normalize_text(text))


def shingle_fingerprint(text: str, *, size: int = 5) -> set[str]:
    words = normalize_text(text).split()
    if len(words) < size:
        return {" ".join(words)} if words else set()
    return {" ".join(words[index : index + size]) for index in range(len(words) - size + 1)}


def jaccard_similarity(left: Iterable[str], right: Iterable[str]) -> float:
    left_set = set(left)
    right_set = set(right)
    if not left_set and not right_set:
        return 1.0
    if not left_set or not right_set:
        return 0.0
    return len(left_set & right_set) / len(left_set | right_set)
