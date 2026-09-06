"""
Chunking strategies.

The original implementation was a flat RecursiveCharacterTextSplitter at
1200/200 characters. That was adequate for the 34 hand-written seed documents,
which are each a single self-contained idea, but the ingested corpus is
engineering-blog articles of 10-30k characters covering several distinct topics
each. Cutting those on character counts splits arguments mid-thought and mixes
unrelated sections into one chunk, which is exactly what hurts retrieval
precision.

Two strategies live here, selected by CHUNK_STRATEGY:

  "character" -- the original. Kept so the Phase 2 comparison can be re-run and
                 so a regression can be reverted by config alone.
  "structural" -- splits on document structure first (markdown headings, then
                 blank-line paragraphs), and only falls back to character
                 splitting inside a section that is still too large. Sections
                 smaller than a floor are merged with their neighbour so the
                 corpus does not fill with one-line fragments.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    metadata: dict


# A markdown heading, or a short line that looks like a section title.
_HEADING_RE = re.compile(r"^(#{1,6})\s+\S", re.M)


def _character_chunks(text: str, *, chunk_size: int, overlap: int) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
        length_function=len,
        is_separator_regex=False,
    )
    return splitter.split_text(text)


def _split_sections(text: str) -> List[str]:
    """Break text on markdown headings, else on blank lines."""
    if _HEADING_RE.search(text):
        parts: List[str] = []
        last = 0
        for match in _HEADING_RE.finditer(text):
            if match.start() > last:
                parts.append(text[last : match.start()])
            last = match.start()
        parts.append(text[last:])
        return [p.strip() for p in parts if p.strip()]

    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _merge_small(sections: List[str], *, min_size: int, max_size: int) -> List[str]:
    """Glue undersized sections onto the previous one, without exceeding max_size."""
    merged: List[str] = []
    for section in sections:
        if merged and (len(merged[-1]) < min_size) and (len(merged[-1]) + len(section) + 2 <= max_size):
            merged[-1] = merged[-1] + "\n\n" + section
        else:
            merged.append(section)
    return merged


def _structural_chunks(text: str, *, chunk_size: int, overlap: int, min_size: int) -> List[str]:
    sections = _merge_small(_split_sections(text), min_size=min_size, max_size=chunk_size)

    chunks: List[str] = []
    for section in sections:
        if len(section) <= chunk_size:
            chunks.append(section)
        else:
            # Still too big: fall back to character splitting *within* the
            # section, so a long section never bleeds into its neighbour.
            chunks.extend(_character_chunks(section, chunk_size=chunk_size, overlap=overlap))
    return [c for c in (c.strip() for c in chunks) if c]


def chunk_text(
    text: str,
    *,
    chunk_size: int,
    overlap: int,
    strategy: str | None = None,
    min_size: int | None = None,
) -> List[str]:
    """Split text into retrievable chunks.

    `strategy` defaults to config.CHUNK_STRATEGY so callers do not have to know
    which one is active.
    """
    from app.core import config

    text = text.strip()
    if not text:
        return []

    chosen = (strategy or config.CHUNK_STRATEGY).strip().lower()
    floor = min_size if min_size is not None else config.CHUNK_MIN_CHARS

    if chosen == "structural":
        return _structural_chunks(text, chunk_size=chunk_size, overlap=overlap, min_size=floor)
    return _character_chunks(text, chunk_size=chunk_size, overlap=overlap)
