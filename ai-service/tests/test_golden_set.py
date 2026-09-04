"""
Integrity of the golden set itself.

A label pointing at a source that does not exist would score 0 forever and look
like a retrieval problem, so the labels are checked against the real corpus.
"""
import json
import os
from collections import Counter

import pytest
from app.eval.golden_set import GOLDEN_SET, by_id

CORPUS_PATH = os.path.join(os.path.dirname(__file__), "..", "seed_data", "documents.json")


@pytest.fixture(scope="module")
def corpus_sources():
    with open(os.path.abspath(CORPUS_PATH)) as fh:
        return {doc["source"] for doc in json.load(fh)}


def test_golden_set_is_not_trivially_small():
    assert len(GOLDEN_SET) >= 30


def test_ids_are_unique():
    ids = [q.id for q in GOLDEN_SET]
    assert len(ids) == len(set(ids))


def test_every_labelled_source_exists_in_the_corpus(corpus_sources):
    unknown = {
        q.id: [s for s in q.relevant_sources if s not in corpus_sources]
        for q in GOLDEN_SET
    }
    unknown = {k: v for k, v in unknown.items() if v}
    assert not unknown, f"labels reference sources not in the corpus: {unknown}"


def test_every_query_has_at_least_one_label():
    assert all(q.relevant_sources for q in GOLDEN_SET)


def test_no_query_is_empty():
    assert all(q.query.strip() for q in GOLDEN_SET)


def test_all_four_companies_are_covered():
    covered = {q.company for q in GOLDEN_SET if q.company}
    assert covered == {"amazon", "google", "meta", "apple"}


def test_all_four_stages_are_covered():
    covered = {q.stage for q in GOLDEN_SET if q.stage}
    assert covered == {"behavioral", "coding", "system_design", "core_cs"}


def test_all_difficulties_are_covered():
    assert {q.difficulty for q in GOLDEN_SET} == {"easy", "medium", "hard"}


def test_contains_both_natural_and_synthetic_queries():
    kinds = Counter(q.kind for q in GOLDEN_SET)
    assert kinds["natural"] > 0 and kinds["synthetic"] > 0


def test_natural_queries_dominate():
    # Synthetic queries mirror what the orchestrator generates and are easy;
    # the natural half is where retrieval improvements actually show up.
    kinds = Counter(q.kind for q in GOLDEN_SET)
    assert kinds["natural"] > kinds["synthetic"]


def test_includes_company_agnostic_queries():
    assert any(q.company is None for q in GOLDEN_SET)


def test_by_id_finds_and_raises():
    assert by_id(GOLDEN_SET[0].id) is GOLDEN_SET[0]
    with pytest.raises(KeyError):
        by_id("does-not-exist")
