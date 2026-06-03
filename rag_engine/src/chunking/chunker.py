"""Semantic markdown chunking for RAG ingestion."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from src.chunking.token_utils import TokenCounter
from src.config.settings import CHUNK_OVERLAP_TOKENS, MAX_CHUNK_TOKENS, MIN_CHUNK_TOKENS
from src.utils.hashing import content_hash


@dataclass(frozen=True)
class TextChunk:
    """A retrieval-ready text chunk enriched with metadata."""

    chunk_id: str
    url: str
    title: str
    section: str
    content: str
    token_count: int
    source_file: str
    heading_path: list[str]
    document_hash: str
    content_type: str = "text"
    source_section: str = ""
    parent_chunk_id: str = ""
    split_index: int = 0
    split_count: int = 1
    raw_content: str = ""

    def to_dict(self) -> dict[str, object]:
        """Serialize a chunk for JSON export."""
        return asdict(self)


@dataclass
class MarkdownBlock:
    """A markdown block with its active heading path."""

    text: str
    heading_path: list[str]
    content_type: str = "text"
    parent_block_id: str = ""
    split_index: int = 0
    split_count: int = 1


def split_markdown_blocks(markdown: str) -> list[MarkdownBlock]:
    """Split markdown into paragraph-aware blocks while preserving code fences."""
    blocks: list[MarkdownBlock] = []
    heading_stack: list[str] = []
    buffer: list[str] = []
    in_code = False
    buffer_type = "text"

    def flush() -> None:
        nonlocal buffer, buffer_type
        text = "\n".join(buffer).strip()
        if text:
            blocks.append(
                MarkdownBlock(
                    text=text,
                    heading_path=heading_stack.copy(),
                    content_type=_detect_content_type(text, buffer_type),
                )
            )
        buffer = []
        buffer_type = "text"

    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            if not in_code and buffer:
                flush()
            buffer_type = "code"
            in_code = not in_code
            buffer.append(line)
            if not in_code:
                flush()
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading_match and not in_code:
            flush()
            level = len(heading_match.group(1))
            heading = heading_match.group(2).strip()
            heading_stack = heading_stack[: level - 1]
            heading_stack.append(heading)
            buffer.append(stripped)
            buffer_type = "heading"
            flush()
            continue

        if not stripped and not in_code:
            flush()
            continue

        if stripped.startswith("|") and "|" in stripped[1:]:
            buffer_type = "table" if buffer_type == "text" else buffer_type
        elif re.match(r"^\s*(-|\d+\.)\s+", line):
            buffer_type = "list" if buffer_type == "text" else buffer_type
        buffer.append(line)

    flush()
    return blocks


def build_chunks(
    markdown: str,
    *,
    metadata: dict[str, object],
    document_hash: str,
    max_tokens: int = MAX_CHUNK_TOKENS,
    min_tokens: int = MIN_CHUNK_TOKENS,
    overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
    token_counter: TokenCounter | None = None,
) -> list[TextChunk]:
    """Create semantic chunks from markdown using headings and paragraphs."""
    counter = token_counter or TokenCounter()
    blocks = split_markdown_blocks(markdown)
    chunks: list[TextChunk] = []
    current_blocks: list[MarkdownBlock] = []
    seen_hashes: set[str] = set()

    def flush(*, keep_overlap: bool = True) -> None:
        nonlocal current_blocks
        if not current_blocks:
            return

        content = "\n\n".join(block.text for block in current_blocks).strip()
        token_count = counter.count(content)
        if token_count < min_tokens and _dominant_content_type(current_blocks) == "heading":
            current_blocks = []
            return
        if token_count < min_tokens and chunks:
            previous = chunks[-1]
            previous_raw_content = previous.raw_content or previous.content
            merged_content = f"{previous_raw_content}\n\n{content}".strip()
            merged_token_count = counter.count(merged_content)
            if merged_token_count <= max_tokens:
                chunks.pop()
                content = merged_content
                token_count = merged_token_count

        chunk_hash = content_hash(content)
        if chunk_hash not in seen_hashes and content:
            seen_hashes.add(chunk_hash)
            heading_path = _dominant_heading_path(current_blocks)
            section = heading_path[-1] if heading_path else str(metadata.get("title", ""))
            chunk_number = len(chunks) + 1
            chunk_id = f"{document_hash[:12]}-{chunk_number:04d}"
            content_type = _dominant_content_type(current_blocks)
            parent_chunk_id = _parent_chunk_id(document_hash, current_blocks)
            split_index, split_count = _split_position(current_blocks)
            raw_content = content
            enriched_content = _enrich_content(content, metadata, heading_path, content_type)
            token_count = counter.count(enriched_content)
            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    url=str(metadata.get("url", "")),
                    title=str(metadata.get("title", "")),
                    section=section,
                    content=enriched_content,
                    token_count=token_count,
                    source_file=str(metadata.get("source_file", "")),
                    heading_path=heading_path,
                    document_hash=document_hash,
                    content_type=content_type,
                    source_section=section,
                    parent_chunk_id=parent_chunk_id,
                    split_index=split_index,
                    split_count=split_count,
                    raw_content=raw_content,
                )
            )

        current_blocks = _overlap_blocks(current_blocks, overlap_tokens, counter) if keep_overlap else []

    for block in blocks:
        block_tokens = counter.count(block.text)
        if current_blocks and _combined_token_count(current_blocks + [block], counter) > max_tokens:
            flush()
            if current_blocks and _combined_token_count(current_blocks + [block], counter) > max_tokens:
                current_blocks = []

        if block_tokens > max_tokens:
            for split_block in _split_large_block(block, max_tokens, counter):
                if current_blocks:
                    flush()
                current_blocks.append(split_block)
                flush(keep_overlap=False)
            continue

        current_blocks.append(block)

    flush()
    return chunks


def _dominant_heading_path(blocks: list[MarkdownBlock]) -> list[str]:
    for block in reversed(blocks):
        if block.heading_path:
            return block.heading_path
    return []


def _dominant_content_type(blocks: list[MarkdownBlock]) -> str:
    content_types = {block.content_type for block in blocks if block.content_type != "heading"}
    if not content_types:
        return "heading"
    if len(content_types) == 1:
        return next(iter(content_types))
    return "mixed"


def _parent_chunk_id(document_hash: str, blocks: list[MarkdownBlock]) -> str:
    parent_ids = {block.parent_block_id for block in blocks if block.parent_block_id}
    if len(parent_ids) == 1:
        return f"{document_hash[:12]}-{next(iter(parent_ids))}"
    return ""


def _split_position(blocks: list[MarkdownBlock]) -> tuple[int, int]:
    split_blocks = [block for block in blocks if block.split_count > 1]
    if len(split_blocks) == 1:
        return split_blocks[0].split_index, split_blocks[0].split_count
    return 0, 1


def _combined_token_count(blocks: list[MarkdownBlock], counter: TokenCounter) -> int:
    """Count tokens after blocks are joined exactly as chunk content."""
    return counter.count("\n\n".join(block.text for block in blocks).strip())


def _overlap_blocks(
    blocks: list[MarkdownBlock],
    overlap_tokens: int,
    counter: TokenCounter,
) -> list[MarkdownBlock]:
    if overlap_tokens <= 0:
        return []

    kept: list[MarkdownBlock] = []
    total = 0
    for block in reversed(blocks):
        block_tokens = counter.count(block.text)
        if block_tokens > overlap_tokens:
            break
        if total + block_tokens > overlap_tokens and kept:
            break
        kept.append(block)
        total += block_tokens

    return list(reversed(kept))


def _split_large_block(
    block: MarkdownBlock,
    max_tokens: int,
    counter: TokenCounter,
) -> list[MarkdownBlock]:
    """Split oversized blocks while preserving as much structure as possible."""
    text = block.text
    if counter.count(text) <= max_tokens:
        return [block]

    if block.content_type == "code" or text.startswith("```"):
        return _with_split_metadata(_split_code_block(block, max_tokens, counter), block)

    if block.content_type == "table" or _looks_like_table(text):
        return _with_split_metadata(_split_table_block(block, max_tokens, counter), block)

    if re.search(r"^\s*(-|\d+\.)\s+", text, flags=re.MULTILINE):
        return _with_split_metadata(_split_lines_at_token_limit(block, max_tokens, counter), block)

    sentences = re.split(r"(?<=[.!?])\s+", text)
    split_blocks: list[MarkdownBlock] = []
    buffer: list[str] = []
    token_count = 0

    for sentence in sentences:
        sentence_tokens = counter.count(sentence)
        if sentence_tokens > max_tokens:
            if buffer:
                split_blocks.append(
                    MarkdownBlock(" ".join(buffer).strip(), block.heading_path.copy(), block.content_type)
                )
                buffer = []
                token_count = 0
            split_blocks.extend(_split_text_by_tokens(block, sentence, max_tokens, counter))
            continue
        if buffer and token_count + sentence_tokens > max_tokens:
            split_blocks.append(MarkdownBlock(" ".join(buffer).strip(), block.heading_path.copy(), block.content_type))
            buffer = []
            token_count = 0
        buffer.append(sentence)
        token_count += sentence_tokens

    if buffer:
        split_blocks.append(MarkdownBlock(" ".join(buffer).strip(), block.heading_path.copy(), block.content_type))

    return _with_split_metadata(split_blocks, block)


def _split_lines_at_token_limit(
    block: MarkdownBlock,
    max_tokens: int,
    counter: TokenCounter,
) -> list[MarkdownBlock]:
    """Split list-like blocks on line boundaries."""
    split_blocks: list[MarkdownBlock] = []
    buffer: list[str] = []
    token_count = 0

    for line in block.text.splitlines():
        line_tokens = counter.count(line)
        if line_tokens > max_tokens:
            if buffer:
                split_blocks.append(MarkdownBlock("\n".join(buffer).strip(), block.heading_path.copy(), block.content_type))
                buffer = []
                token_count = 0
            split_blocks.extend(_split_text_by_tokens(block, line, max_tokens, counter))
            continue
        if buffer and token_count + line_tokens > max_tokens:
            split_blocks.append(MarkdownBlock("\n".join(buffer).strip(), block.heading_path.copy(), block.content_type))
            buffer = []
            token_count = 0
        buffer.append(line)
        token_count += line_tokens

    if buffer:
        split_blocks.append(MarkdownBlock("\n".join(buffer).strip(), block.heading_path.copy(), block.content_type))

    return split_blocks


def _split_code_block(block: MarkdownBlock, max_tokens: int, counter: TokenCounter) -> list[MarkdownBlock]:
    lines = block.text.splitlines()
    opening = lines[0] if lines and lines[0].strip().startswith("```") else "```"
    closing = lines[-1] if len(lines) > 1 and lines[-1].strip().startswith("```") else "```"
    body = lines[1:-1] if closing == lines[-1] and opening == lines[0] else lines
    wrapper_tokens = counter.count(f"{opening}\n{closing}")
    body_budget = max(1, max_tokens - wrapper_tokens - 16)
    body_block = MarkdownBlock("\n".join(body), block.heading_path.copy(), "code")
    pieces = _split_lines_at_token_limit(body_block, body_budget, counter)
    return [
        MarkdownBlock(f"{opening}\n{piece.text}\n{closing}".strip(), block.heading_path.copy(), "code")
        for piece in pieces
        if piece.text.strip()
    ]


def _split_table_block(block: MarkdownBlock, max_tokens: int, counter: TokenCounter) -> list[MarkdownBlock]:
    lines = [line for line in block.text.splitlines() if line.strip()]
    if len(lines) <= 2:
        return _split_lines_at_token_limit(block, max_tokens, counter)

    header = lines[:2] if _is_table_separator(lines[1]) else lines[:1]
    rows = lines[len(header) :]
    split_blocks: list[MarkdownBlock] = []
    buffer = header.copy()

    for row in rows:
        candidate = "\n".join(buffer + [row])
        if counter.count(candidate) > max_tokens and len(buffer) > len(header):
            split_blocks.append(MarkdownBlock("\n".join(buffer).strip(), block.heading_path.copy(), "table"))
            buffer = header.copy()
        if counter.count("\n".join(buffer + [row])) > max_tokens:
            split_blocks.extend(_split_text_by_tokens(block, row, max_tokens, counter))
            buffer = header.copy()
            continue
        buffer.append(row)

    if len(buffer) > len(header):
        split_blocks.append(MarkdownBlock("\n".join(buffer).strip(), block.heading_path.copy(), "table"))

    return split_blocks or _split_lines_at_token_limit(block, max_tokens, counter)


def _split_text_by_tokens(
    block: MarkdownBlock,
    text: str,
    max_tokens: int,
    counter: TokenCounter,
) -> list[MarkdownBlock]:
    words = text.split()
    if not words:
        return []

    split_blocks: list[MarkdownBlock] = []
    buffer: list[str] = []
    for word in words:
        candidate = " ".join(buffer + [word])
        if buffer and counter.count(candidate) > max_tokens:
            split_blocks.append(MarkdownBlock(" ".join(buffer), block.heading_path.copy(), block.content_type))
            buffer = []
        buffer.append(word)

    if buffer:
        split_blocks.append(MarkdownBlock(" ".join(buffer), block.heading_path.copy(), block.content_type))

    return split_blocks


def _with_split_metadata(split_blocks: list[MarkdownBlock], original: MarkdownBlock) -> list[MarkdownBlock]:
    clean_blocks = [block for block in split_blocks if block.text.strip()]
    split_count = len(clean_blocks)
    if split_count <= 1:
        return clean_blocks

    parent_block_id = f"parent-{content_hash(original.text)[:12]}"
    return [
        MarkdownBlock(
            text=block.text,
            heading_path=block.heading_path.copy(),
            content_type=block.content_type,
            parent_block_id=parent_block_id,
            split_index=index,
            split_count=split_count,
        )
        for index, block in enumerate(clean_blocks, start=1)
    ]


def _detect_content_type(text: str, hinted_type: str = "text") -> str:
    if hinted_type != "text":
        return hinted_type
    stripped = text.strip()
    if stripped.startswith("```"):
        return "code"
    if _looks_like_table(stripped):
        return "table"
    if re.search(r"^\s*(-|\d+\.)\s+", stripped, flags=re.MULTILINE):
        return "list"
    if re.match(r"^#{1,6}\s+", stripped):
        return "heading"
    return "text"


def _looks_like_table(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return len(lines) >= 2 and all(line.startswith("|") and "|" in line[1:] for line in lines[:2])


def _is_table_separator(line: str) -> bool:
    return bool(re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", line.strip()))


def _enrich_content(
    content: str,
    metadata: dict[str, object],
    heading_path: list[str],
    content_type: str,
) -> str:
    """Add lightweight semantic labels to help retrieval stay aligned with structure."""
    page = str(metadata.get("title") or metadata.get("url") or "").strip()
    section = heading_path[0] if len(heading_path) >= 1 else str(metadata.get("title", "")).strip()
    subsection = heading_path[1] if len(heading_path) >= 2 else ""
    entity_type = _infer_entity_type(content_type, heading_path, content)

    parts: list[str] = []
    if page:
        parts.append(f"Page: {page}")
    if section:
        parts.append(f"Section: {section}")
    if subsection:
        parts.append(f"Subsection: {subsection}")
    if entity_type:
        parts.append(f"Entity Type: {entity_type}")
    parts.append("Content:")
    parts.append(content.strip())
    return "\n".join(parts)


def _infer_entity_type(content_type: str, heading_path: list[str], content: str) -> str:
    heading_text = " ".join(heading_path).lower()
    content_text = content.lower()

    if "faq" in heading_text or "faqs" in heading_text or "question" in content_text:
        return "FAQ"
    if any(keyword in heading_text for keyword in ("pricing", "plans", "packages", "subscription")):
        return "Pricing Card"
    if any(keyword in heading_text for keyword in ("team", "people", "leadership", "about us")):
        return "Team Member"
    if any(keyword in heading_text for keyword in ("service", "services", "what we do", "solutions")):
        return "Service Card"
    if content_type == "table":
        return "Structured Table"
    if content_type == "list":
        return "Structured List"
    if content_type == "code":
        return "Code Block"
    return content_type.replace("_", " ").title() if content_type and content_type != "text" else "Text Block"

