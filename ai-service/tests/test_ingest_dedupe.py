import pytest
from app.ingest.dedupe import (
    DuplicateIndex, hamming, is_near_duplicate, shingles, simhash, tokenize,
)

A = ("Database sharding splits a large table across nodes by a key such as user id. "
     "Hash based sharding spreads load evenly but makes range queries harder.")
NEAR = ("Database sharding splits a large table across nodes by a key such as user id! "
        "Hash-based sharding spreads load evenly, but makes range queries harder.")
DIFFERENT = ("Kubernetes schedules pods onto nodes using requests and limits, and the "
             "control plane reconciles desired state continuously over time.")


def test_tokenize_lowercases_and_strips_punctuation():
    assert tokenize("Hello, World! 42") == ["hello", "world", "42"]


def test_shingles_are_overlapping_ngrams():
    assert shingles(["a", "b", "c", "d"], 2) == ["a b", "b c", "c d"]


def test_shingles_handles_text_shorter_than_the_window():
    assert shingles(["a"], 3) == ["a"]
    assert shingles([], 3) == []


def test_simhash_is_deterministic():
    assert simhash(A) == simhash(A)


def test_simhash_of_empty_text_is_zero():
    assert simhash("") == 0


def test_hamming_distance_basics():
    assert hamming(0b1010, 0b1010) == 0
    assert hamming(0b1010, 0b1011) == 1


def test_near_duplicate_detects_punctuation_and_spacing_changes():
    assert is_near_duplicate(A, NEAR)


def test_near_duplicate_rejects_unrelated_text():
    assert not is_near_duplicate(A, DIFFERENT)


def test_identical_text_is_a_duplicate():
    assert is_near_duplicate(A, A)


class TestDuplicateIndex:
    def test_first_insert_is_new(self):
        idx = DuplicateIndex()
        assert idx.add_if_new(A, "a") is True
        assert len(idx) == 1

    def test_near_duplicate_is_rejected_and_not_stored(self):
        idx = DuplicateIndex()
        idx.add_if_new(A, "a")
        assert idx.add_if_new(NEAR, "b") is False
        assert len(idx) == 1

    def test_distinct_text_is_accepted(self):
        idx = DuplicateIndex()
        idx.add_if_new(A, "a")
        assert idx.add_if_new(DIFFERENT, "b") is True
        assert len(idx) == 2

    def test_find_duplicate_reports_the_original_ref(self):
        idx = DuplicateIndex()
        idx.add_if_new(A, "https://example.com/original")
        assert idx.find_duplicate(NEAR) == "https://example.com/original"

    def test_empty_text_is_never_a_duplicate(self):
        idx = DuplicateIndex()
        idx.add_if_new(A, "a")
        assert idx.find_duplicate("") is None


class TestCanonicalUrl:
    """Tracking parameters must not create new document identities."""

    def test_strips_medium_style_tracking_token(self):
        from app.ingest.live import canonical_url
        a = "https://netflixtechblog.com/post-abc?gi=111&source=rss----x---4"
        assert canonical_url(a) == "https://netflixtechblog.com/post-abc"

    def test_same_article_with_different_tokens_has_one_identity(self):
        from app.ingest.live import url_key
        a = "https://netflixtechblog.com/post-abc?gi=111&source=rss----x---4"
        b = "https://netflixtechblog.com/post-abc?gi=999&source=rss----y---9"
        assert url_key(a) == url_key(b)

    def test_strips_utm_parameters(self):
        from app.ingest.live import canonical_url
        got = canonical_url("https://example.com/p?utm_source=x&utm_campaign=y&id=7")
        assert got == "https://example.com/p?id=7"

    def test_keeps_meaningful_query_parameters(self):
        from app.ingest.live import canonical_url
        assert "page=2" in canonical_url("https://example.com/p?page=2")

    def test_drops_the_fragment(self):
        from app.ingest.live import canonical_url
        assert canonical_url("https://example.com/p#section") == "https://example.com/p"

    def test_normalises_trailing_slash_and_case(self):
        from app.ingest.live import url_key
        assert url_key("https://Example.COM/p/") == url_key("https://example.com/p")

    def test_different_articles_keep_different_identities(self):
        from app.ingest.live import url_key
        assert url_key("https://example.com/a") != url_key("https://example.com/b")
