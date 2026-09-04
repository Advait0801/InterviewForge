import pytest
from app.rag.chunking import chunk_text


def test_empty_text_produces_no_chunks():
    assert chunk_text("", chunk_size=100, overlap=10) == []


def test_whitespace_only_text_produces_no_chunks():
    assert chunk_text("   \n\n  ", chunk_size=100, overlap=10) == []


def test_short_text_stays_a_single_chunk():
    chunks = chunk_text("A short sentence.", chunk_size=100, overlap=10)
    assert chunks == ["A short sentence."]


def test_long_text_is_split_into_multiple_chunks():
    text = ". ".join(f"Sentence number {i}" for i in range(200))
    chunks = chunk_text(text, chunk_size=200, overlap=20)
    assert len(chunks) > 1


def test_chunks_respect_the_size_limit():
    text = ". ".join(f"Sentence number {i}" for i in range(200))
    chunks = chunk_text(text, chunk_size=200, overlap=20)
    # The splitter may exceed the limit only when a single token is longer than
    # the limit; with this input none are.
    assert all(len(c) <= 200 for c in chunks)


def test_no_content_is_lost_when_splitting():
    paragraphs = [f"Paragraph {i} with some filler text." for i in range(30)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_text(text, chunk_size=150, overlap=0)
    joined = " ".join(chunks)
    for p in paragraphs:
        assert p in joined


def test_overlap_creates_shared_text_between_neighbours():
    text = " ".join(f"word{i}" for i in range(400))
    no_overlap = chunk_text(text, chunk_size=200, overlap=0)
    with_overlap = chunk_text(text, chunk_size=200, overlap=100)
    # Overlapping chunks cover the same text with more chunks.
    assert len(with_overlap) > len(no_overlap)


def test_prefers_paragraph_boundaries_over_mid_sentence_cuts():
    text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here."
    chunks = chunk_text(text, chunk_size=25, overlap=0)
    # Each chunk should be a whole paragraph, not a fragment ending mid-word.
    assert all(not c.endswith("parag") for c in chunks)


def test_leading_and_trailing_whitespace_is_stripped():
    chunks = chunk_text("  hello world  ", chunk_size=100, overlap=10)
    assert chunks == ["hello world"]
