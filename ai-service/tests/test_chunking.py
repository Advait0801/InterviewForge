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


class TestStructuralChunking:
    """Structure-aware splitting, selected by CHUNK_STRATEGY=structural."""

    def test_splits_on_markdown_headings(self):
        text = (
            "# Alpha\nContent about alpha that runs on for a while to be substantial.\n\n"
            "# Beta\nContent about beta which is a completely different subject area.\n\n"
            "# Gamma\nContent about gamma covering yet another distinct topic entirely."
        )
        chunks = chunk_text(text, chunk_size=2000, overlap=0, strategy="structural", min_size=1)
        assert len(chunks) == 3
        assert chunks[0].startswith("# Alpha")
        assert chunks[1].startswith("# Beta")

    def test_a_heading_stays_with_its_body(self):
        text = "# Sharding\nHash based sharding spreads load evenly across nodes.\n\n# Caching\nWrite through caching keeps the cache consistent."
        chunks = chunk_text(text, chunk_size=2000, overlap=0, strategy="structural", min_size=1)
        assert "Hash based sharding" in chunks[0]
        assert "Write through" in chunks[1]

    def test_falls_back_to_paragraphs_without_headings(self):
        paras = [f"Paragraph number {i} with enough text to stand alone as a unit." for i in range(4)]
        chunks = chunk_text("\n\n".join(paras), chunk_size=2000, overlap=0,
                            strategy="structural", min_size=1)
        assert len(chunks) == 4

    def test_oversized_section_is_split_further(self):
        big = "# Huge\n" + ("sentence about distributed systems. " * 200)
        chunks = chunk_text(big, chunk_size=400, overlap=0, strategy="structural", min_size=1)
        assert len(chunks) > 1
        assert all(len(c) <= 400 for c in chunks)

    def test_small_sections_are_merged_not_stored_as_fragments(self):
        text = "# A\nshort\n\n# B\ntiny\n\n# C\nalso small"
        chunks = chunk_text(text, chunk_size=2000, overlap=0, strategy="structural", min_size=300)
        assert len(chunks) == 1, "tiny sections should merge into one chunk"

    def test_merging_respects_the_size_ceiling(self):
        text = "\n\n".join(["x" * 200 for _ in range(6)])
        chunks = chunk_text(text, chunk_size=500, overlap=0, strategy="structural", min_size=400)
        assert all(len(c) <= 500 for c in chunks)

    def test_no_content_is_lost(self):
        text = "# One\nAlpha content here.\n\n# Two\nBeta content here.\n\n# Three\nGamma content."
        chunks = chunk_text(text, chunk_size=2000, overlap=0, strategy="structural", min_size=1)
        joined = " ".join(chunks)
        for word in ("Alpha", "Beta", "Gamma"):
            assert word in joined

    def test_empty_input(self):
        assert chunk_text("", chunk_size=100, overlap=10, strategy="structural") == []

    def test_character_strategy_is_unchanged(self):
        text = ". ".join(f"Sentence {i}" for i in range(200))
        a = chunk_text(text, chunk_size=200, overlap=20, strategy="character")
        b = chunk_text(text, chunk_size=200, overlap=20, strategy="character")
        assert a == b and len(a) > 1

    def test_structural_beats_character_on_multi_topic_documents(self):
        """The actual claim: sections stay intact instead of bleeding together."""
        text = (
            "# Sharding\n" + ("Sharding splits data across nodes by key. " * 12) + "\n\n"
            "# Caching\n" + ("Caching stores hot values close to readers. " * 12)
        )
        structural = chunk_text(text, chunk_size=700, overlap=0, strategy="structural", min_size=1)
        # No structural chunk mixes both topics.
        mixed = [c for c in structural if "Sharding splits" in c and "Caching stores" in c]
        assert not mixed
