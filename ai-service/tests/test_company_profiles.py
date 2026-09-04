import pytest
from app.interview.company_profiles import (
    COMPANY_PROFILES,
    get_company_profile,
    get_difficulty_calibration,
)

STAGES = ("behavioral", "coding", "system_design", "core_cs")
DIFFICULTIES = ("easy", "medium", "hard")


@pytest.mark.parametrize("company", sorted(COMPANY_PROFILES))
def test_every_profile_is_fully_populated(company):
    p = get_company_profile(company)
    assert p.name.strip()
    assert p.style.strip()
    assert p.focus_areas


@pytest.mark.parametrize("company", sorted(COMPANY_PROFILES))
@pytest.mark.parametrize("stage", STAGES)
def test_every_company_covers_every_stage(company, stage):
    assert get_company_profile(company).stage_topics.get(stage, "").strip()


@pytest.mark.parametrize("company", sorted(COMPANY_PROFILES))
@pytest.mark.parametrize("difficulty", DIFFICULTIES)
def test_every_company_calibrates_every_difficulty(company, difficulty):
    assert get_difficulty_calibration(company, difficulty).strip()


def test_lookup_is_case_and_whitespace_insensitive():
    assert get_company_profile("  AMAZON ").key == "amazon"


def test_unknown_company_raises_valueerror():
    with pytest.raises(ValueError):
        get_company_profile("netflix")


def test_unknown_difficulty_falls_back_to_medium():
    assert get_difficulty_calibration("amazon", "impossible") == get_difficulty_calibration(
        "amazon", "medium"
    )


def test_difficulty_calibrations_are_distinct_per_level():
    # If easy and hard produced the same text, calibration would be doing nothing.
    p = get_company_profile("amazon")
    assert p.difficulty_calibration["easy"] != p.difficulty_calibration["hard"]
