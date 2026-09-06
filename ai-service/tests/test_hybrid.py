"""BM25 and Reciprocal Rank Fusion."""
import pytest
from app.rag.hybrid import BM25Index, reciprocal_rank_fusion, tokenize

DOCS = [
    "database sharding splits a large table across nodes by a key",
    "caching stores hot values close to readers to reduce latency",
    "isabelle hol is a proof assistant for verifying distributed systems",
    "sharding and caching are both scaling techniques for databases",
]
IDS = ["d0", "d1", "d2", "d3"]


@pytest.fixture
def index():
    return BM25Index(IDS, DOCS)


def test_tokenize_lowercases_and_drops_punctuation():
    assert tokenize("Isabelle/HOL, v2!") == ["isabelle", "hol", "v2"]


def test_exact_rare_term_ranks_first(index):
    # The case dense retrieval is weak at: a rare exact token.
    top = index.search("isabelle hol", limit=3)
    assert top[0][0] == "d2"


def test_scores_are_positive_only_for_matching_documents(index):
    results = dict(index.search("sharding", limit=10))
    assert "d0" in results and "d3" in results
    assert "d1" not in results


def test_idf_penalises_common_terms(index):
    # "sharding" appears in 2 of 4 docs, "isabelle" in 1 -> rarer term scores higher.
    assert index.idf("isabelle") > index.idf("sharding")


def test_unknown_term_scores_zero(index):
    assert index.search("kubernetes", limit=5) == []


def test_empty_query_returns_nothing(index):
    assert index.search("", limit=5) == []


def test_limit_is_respected(index):
    assert len(index.search("sharding caching databases", limit=1)) == 1


def test_empty_index_is_safe():
    empty = BM25Index([], [])
    assert empty.search("anything", limit=5) == []


class TestRRF:
    def test_fuses_two_rankings(self):
        scores = reciprocal_rank_fusion([["a", "b"], ["b", "a"]], k=60)
        assert set(scores) == {"a", "b"}

    def test_document_ranked_highly_in_both_wins(self):
        scores = reciprocal_rank_fusion([["a", "b", "c"], ["a", "c", "b"]], k=60)
        assert scores["a"] > scores["b"] and scores["a"] > scores["c"]

    def test_uses_rank_not_score_magnitude(self):
        # Identical rankings must produce identical fused scores regardless of
        # what the underlying systems' raw scores were.
        one = reciprocal_rank_fusion([["a", "b"]], k=60)
        two = reciprocal_rank_fusion([["a", "b"]], k=60)
        assert one == two

    def test_appearing_in_more_lists_beats_appearing_once_higher(self):
        scores = reciprocal_rank_fusion([["x", "a"], ["y", "a"], ["z", "a"]], k=60)
        # "a" is 2nd in three lists; x/y/z are 1st in one each.
        assert scores["a"] > scores["x"]

    def test_k_dampens_rank_differences(self):
        small_k = reciprocal_rank_fusion([["a", "b"]], k=1)
        large_k = reciprocal_rank_fusion([["a", "b"]], k=1000)
        assert (small_k["a"] - small_k["b"]) > (large_k["a"] - large_k["b"])

    def test_empty_input(self):
        assert reciprocal_rank_fusion([]) == {}
