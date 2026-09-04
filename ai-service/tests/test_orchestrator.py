"""Retrieval query construction and the company-filter fallback."""
import pytest
from app.interview.orchestrator import (
    build_retrieval_query,
    build_context_from_hits,
    retrieve_company_context,
    get_company_style,
)


class RecordingRAG:
    """Records each retrieve() call and replays scripted results."""

    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def retrieve(self, query, *, top_k, where=None):
        self.calls.append({"query": query, "top_k": top_k, "where": where})
        return self._results.pop(0)


def test_query_includes_company_stage_and_difficulty():
    q = build_retrieval_query(company="amazon", stage="behavioral", difficulty="medium")
    assert "Amazon" in q
    assert "behavioral" in q
    assert "medium" in q


def test_query_includes_the_stage_topic_not_just_the_stage_name():
    q = build_retrieval_query(company="amazon", stage="system_design", difficulty="hard")
    assert "scalable systems" in q


def test_query_includes_focus_areas():
    q = build_retrieval_query(company="amazon", stage="coding", difficulty="easy")
    assert "ownership" in q


def test_query_includes_difficulty_calibration():
    q = build_retrieval_query(company="amazon", stage="coding", difficulty="hard")
    assert "Calibration:" in q


def test_query_appends_previous_answer_when_present():
    q = build_retrieval_query(
        company="google", stage="coding", difficulty="medium", previous_answer="I used a heap"
    )
    assert "Candidate previously said: I used a heap" in q


def test_query_omits_previous_answer_when_absent():
    q = build_retrieval_query(company="google", stage="coding", difficulty="medium")
    assert "Candidate previously said" not in q


def test_unknown_company_raises():
    with pytest.raises(ValueError):
        build_retrieval_query(company="netflix", stage="coding", difficulty="medium")


def test_company_name_is_case_insensitive():
    assert "Amazon" in build_retrieval_query(
        company="AMAZON", stage="coding", difficulty="medium"
    )


def test_retrieve_filters_by_company_and_stage():
    rag = RecordingRAG([{"hits": [{"text": "ctx"}]}])
    retrieve_company_context(
        rag=rag, company="amazon", stage="behavioral", difficulty="medium", top_k=5
    )
    where = rag.calls[0]["where"]
    assert {"company": {"$eq": "amazon"}} in where["$and"]
    assert {"stage": {"$eq": "behavioral"}} in where["$and"]


def test_retrieve_does_not_retry_when_the_filter_matches():
    rag = RecordingRAG([{"hits": [{"text": "ctx"}]}])
    retrieve_company_context(
        rag=rag, company="amazon", stage="behavioral", difficulty="medium", top_k=5
    )
    assert len(rag.calls) == 1


def test_retrieve_falls_back_to_an_unfiltered_query_when_nothing_matches():
    rag = RecordingRAG([{"hits": []}, {"hits": [{"text": "general ctx"}]}])
    result = retrieve_company_context(
        rag=rag, company="apple", stage="core_cs", difficulty="hard", top_k=5
    )
    assert len(rag.calls) == 2
    assert rag.calls[0]["where"] is not None
    assert rag.calls[1]["where"] is None
    assert result["hits"] == [{"text": "general ctx"}]


def test_fallback_reuses_the_same_query_string():
    rag = RecordingRAG([{"hits": []}, {"hits": [{"text": "x"}]}])
    retrieve_company_context(
        rag=rag, company="meta", stage="coding", difficulty="easy", top_k=5
    )
    assert rag.calls[0]["query"] == rag.calls[1]["query"]


def test_context_joins_hits_with_a_separator():
    ctx = build_context_from_hits([{"text": "one"}, {"text": "two"}])
    assert "one" in ctx and "two" in ctx and "---" in ctx


def test_context_has_an_explicit_fallback_when_there_are_no_hits():
    # Must not return an empty string: the prompt needs to say "nothing found"
    # rather than silently sending blank context to the LLM.
    assert build_context_from_hits([]) == "No specific retrieval context available."


def test_every_company_has_a_style():
    for company in ("amazon", "google", "meta", "apple"):
        assert get_company_style(company).strip()
