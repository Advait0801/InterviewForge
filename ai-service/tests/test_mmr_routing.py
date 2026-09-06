"""MMR selection and per-stage routing."""
import pytest
from app.rag.mmr import cosine, mmr_select
from app.rag.routing import all_routes, route_for


def hit(id_, text, distance, embedding=None):
    h = {"id": id_, "text": text, "distance": distance, "metadata": {}}
    if embedding:
        h["embedding"] = embedding
    return h


class TestCosine:
    def test_identical_vectors(self):
        assert cosine([1, 0], [1, 0]) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert cosine([1, 0], [0, 1]) == pytest.approx(0.0)

    def test_zero_vector_is_safe(self):
        assert cosine([0, 0], [1, 1]) == 0.0

    def test_mismatched_lengths_are_safe(self):
        assert cosine([1, 0], [1, 0, 0]) == 0.0


class TestMMR:
    def test_returns_requested_count(self):
        hits = [hit(str(i), f"text {i}", 0.1 * i) for i in range(6)]
        assert len(mmr_select(None, hits, keep=3)) == 3

    def test_returns_everything_when_keep_exceeds_candidates(self):
        hits = [hit("a", "x", 0.1)]
        assert len(mmr_select(None, hits, keep=5)) == 1

    def test_empty_input(self):
        assert mmr_select(None, [], keep=3) == []

    def test_most_relevant_is_picked_first(self):
        hits = [hit("far", "aaa", 0.9), hit("near", "bbb", 0.05)]
        assert mmr_select(None, hits, keep=1)[0]["id"] == "near"

    def test_lambda_one_is_pure_relevance(self):
        hits = [hit("a", "same text", 0.10), hit("b", "same text", 0.15), hit("c", "other", 0.20)]
        picked = [h["id"] for h in mmr_select(None, hits, keep=2, lambda_=1.0)]
        assert picked == ["a", "b"]

    def test_low_lambda_prefers_a_diverse_second_pick(self):
        hits = [
            hit("a", "sharding sharding sharding", 0.10),
            hit("b", "sharding sharding sharding", 0.12),
            hit("c", "completely different subject matter", 0.30),
        ]
        picked = [h["id"] for h in mmr_select(None, hits, keep=2, lambda_=0.2)]
        assert picked[0] == "a"
        assert picked[1] == "c", "diversity should beat the near-duplicate"

    def test_bm25_only_hits_without_distance_are_not_discarded(self):
        hits = [hit("dense", "x", 0.2), {"id": "sparse", "text": "y", "metadata": {}, "distance": None}]
        assert len(mmr_select(None, hits, keep=2)) == 2

    def test_uses_embeddings_when_available(self):
        hits = [
            hit("a", "x", 0.1, embedding=[1.0, 0.0]),
            hit("b", "y", 0.11, embedding=[1.0, 0.0]),   # identical direction
            hit("c", "z", 0.30, embedding=[0.0, 1.0]),   # orthogonal
        ]
        picked = [h["id"] for h in mmr_select(None, hits, keep=2, lambda_=0.3)]
        assert picked == ["a", "c"]


class TestRouting:
    def test_every_interview_stage_has_a_route(self):
        for stage in ("behavioral", "coding", "system_design", "core_cs"):
            assert route_for(stage).stage == stage

    def test_term_heavy_stages_use_hybrid_not_rerank(self):
        # BM25 earns its keep where queries turn on precise vocabulary.
        for stage in ("coding", "core_cs"):
            route = route_for(stage)
            assert route.hybrid and not route.rerank

    def test_semantic_stages_use_the_reranker(self):
        for stage in ("behavioral", "system_design"):
            route = route_for(stage)
            assert route.rerank and not route.hybrid

    def test_unknown_stage_falls_back_to_highest_quality(self):
        assert route_for("nonsense").rerank is True

    def test_missing_stage_falls_back(self):
        assert route_for(None).stage == "default"

    def test_case_and_whitespace_insensitive(self):
        assert route_for("  CODING ").stage == "coding"

    def test_every_route_documents_its_reason(self):
        for route in all_routes().values():
            assert len(route.reason) > 20
