"""
The metrics decide whether Phase 2/3 changes count as improvements, so they are
verified against hand-computed values rather than trusted.
"""
import math
import pytest
from app.eval.metrics import (
    aggregate,
    precision_at_k_normalized,
    evaluate_one,
    hit_rate_at_k,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)


class TestPrecision:
    def test_all_relevant(self):
        assert precision_at_k(["a", "b"], {"a", "b"}, 2) == 1.0

    def test_none_relevant(self):
        assert precision_at_k(["x", "y"], {"a"}, 2) == 0.0

    def test_half_relevant(self):
        assert precision_at_k(["a", "x"], {"a"}, 2) == 0.5

    def test_only_counts_the_top_k(self):
        # "a" sits at rank 3, outside k=2.
        assert precision_at_k(["x", "y", "a"], {"a"}, 2) == 0.0

    def test_divides_by_k_not_by_results_returned(self):
        # Returning 1 result when 5 were asked for is a failure, not precision 1.0.
        assert precision_at_k(["a"], {"a"}, 5) == pytest.approx(0.2)

    def test_zero_k_is_zero(self):
        assert precision_at_k(["a"], {"a"}, 0) == 0.0

    def test_empty_retrieval(self):
        assert precision_at_k([], {"a"}, 5) == 0.0


class TestNormalizedPrecision:
    def test_perfect_retrieval_scores_one_even_when_k_exceeds_relevant_count(self):
        # Raw precision@5 with 1 relevant doc caps at 0.2; normalised it is 1.0.
        assert precision_at_k(["a", "x", "y", "z", "w"], {"a"}, 5) == pytest.approx(0.2)
        assert precision_at_k_normalized(["a", "x", "y", "z", "w"], {"a"}, 5) == pytest.approx(1.0)

    def test_total_miss_is_zero(self):
        assert precision_at_k_normalized(["x"], {"a"}, 5) == 0.0

    def test_half_of_achievable(self):
        # 2 relevant, k=4 -> ceiling 0.5; found 1 of 2 -> raw 0.25 -> normalised 0.5
        assert precision_at_k_normalized(["a", "x", "y", "z"], {"a", "b"}, 4) == pytest.approx(0.5)

    def test_matches_raw_precision_when_relevant_count_exceeds_k(self):
        assert precision_at_k_normalized(["a", "b"], {"a", "b", "c"}, 2) == pytest.approx(
            precision_at_k(["a", "b"], {"a", "b", "c"}, 2)
        )

    def test_bounded(self):
        for r in (["a"], ["x"], []):
            assert 0.0 <= precision_at_k_normalized(r, {"a"}, 3) <= 1.0


class TestRecall:
    def test_finds_all_relevant(self):
        assert recall_at_k(["a", "b"], {"a", "b"}, 5) == 1.0

    def test_finds_half(self):
        assert recall_at_k(["a", "x"], {"a", "b"}, 5) == 0.5

    def test_limited_by_k(self):
        assert recall_at_k(["a", "b"], {"a", "b"}, 1) == 0.5

    def test_no_labelled_relevant_is_treated_as_perfect(self):
        assert recall_at_k(["a"], set(), 5) == 1.0

    def test_is_not_affected_by_extra_irrelevant_results(self):
        assert recall_at_k(["a", "x", "y", "z"], {"a"}, 5) == 1.0


class TestHitRate:
    def test_hit(self):
        assert hit_rate_at_k(["x", "a"], {"a"}, 5) == 1.0

    def test_miss(self):
        assert hit_rate_at_k(["x", "y"], {"a"}, 5) == 0.0

    def test_relevant_outside_k_is_a_miss(self):
        assert hit_rate_at_k(["x", "y", "a"], {"a"}, 2) == 0.0


class TestReciprocalRank:
    def test_first_position(self):
        assert reciprocal_rank(["a", "x"], {"a"}) == 1.0

    def test_second_position(self):
        assert reciprocal_rank(["x", "a"], {"a"}) == 0.5

    def test_third_position(self):
        assert reciprocal_rank(["x", "y", "a"], {"a"}) == pytest.approx(1 / 3)

    def test_not_found(self):
        assert reciprocal_rank(["x", "y"], {"a"}) == 0.0

    def test_uses_the_first_relevant_not_the_best(self):
        assert reciprocal_rank(["b", "a"], {"a", "b"}) == 1.0


class TestNDCG:
    def test_perfect_ranking(self):
        assert ndcg_at_k(["a", "b"], {"a", "b"}, 2) == pytest.approx(1.0)

    def test_nothing_relevant(self):
        assert ndcg_at_k(["x", "y"], {"a"}, 2) == 0.0

    def test_is_rank_sensitive_unlike_precision(self):
        # Same documents, different order: precision ties, nDCG does not.
        good = ndcg_at_k(["a", "x"], {"a"}, 2)
        bad = ndcg_at_k(["x", "a"], {"a"}, 2)
        assert precision_at_k(["a", "x"], {"a"}, 2) == precision_at_k(["x", "a"], {"a"}, 2)
        assert good > bad

    def test_matches_hand_computed_value(self):
        # One relevant doc at rank 2: DCG = 1/log2(3); IDCG = 1/log2(2) = 1.
        expected = (1 / math.log2(3)) / 1.0
        assert ndcg_at_k(["x", "a"], {"a"}, 2) == pytest.approx(expected)

    def test_bounded_between_zero_and_one(self):
        for retrieved in (["a", "b", "c"], ["c", "a"], ["x"], []):
            score = ndcg_at_k(retrieved, {"a", "b"}, 3)
            assert 0.0 <= score <= 1.0


class TestEvaluateOne:
    def test_returns_every_metric(self):
        scores = evaluate_one(["a"], ["a"], 1)
        assert set(scores) == {
            "precision_at_k", "precision_norm", "recall_at_k", "hit_rate", "mrr", "ndcg_at_k"
        }

    def test_perfect_retrieval_scores_one_everywhere(self):
        scores = evaluate_one(["a", "b"], ["a", "b"], 2)
        assert all(v == pytest.approx(1.0) for v in scores.values())

    def test_normalised_precision_is_one_for_perfect_sparse_retrieval(self):
        scores = evaluate_one(["a", "x", "y"], ["a"], 3)
        assert scores["precision_norm"] == pytest.approx(1.0)

    def test_total_miss_scores_zero_except_recall_semantics(self):
        scores = evaluate_one(["x", "y"], ["a"], 2)
        assert scores["precision_at_k"] == 0.0
        assert scores["hit_rate"] == 0.0
        assert scores["mrr"] == 0.0
        assert scores["ndcg_at_k"] == 0.0
        assert scores["recall_at_k"] == 0.0
        assert scores["precision_norm"] == 0.0


class TestAggregate:
    def test_empty_input(self):
        assert aggregate([]) == {}

    def test_means_each_metric(self):
        result = aggregate([{"m": 1.0}, {"m": 0.0}])
        assert result["m"] == 0.5

    def test_preserves_all_keys(self):
        result = aggregate([{"a": 1.0, "b": 0.0}, {"a": 0.0, "b": 1.0}])
        assert result == {"a": 0.5, "b": 0.5}
