"""Token counting utilities."""

from __future__ import annotations


class TokenCounter:
    def __init__(self, encoding_name: str = "cl100k_base") -> None:
        self.encoding = None
        try:
            import tiktoken

            self.encoding = tiktoken.get_encoding(encoding_name)
        except Exception:
            self.encoding = None

    def count(self, text: str) -> int:
        if not text:
            return 0
        if self.encoding is not None:
            return len(self.encoding.encode(text))
        return max(1, int(len(text.split()) * 1.3))

    def trim_to_token_count(self, text: str, max_tokens: int) -> str:
        if self.encoding is None:
            return " ".join(text.split()[:max_tokens])
        tokens = self.encoding.encode(text)
        return self.encoding.decode(tokens[:max_tokens])


default_counter = TokenCounter()


def count_tokens(text: str) -> int:
    return default_counter.count(text)
