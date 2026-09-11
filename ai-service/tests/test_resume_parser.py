"""Resume PDF parsing, with the failure modes weighted more heavily than the
happy path -- a resume is the only untrusted binary this system parses."""
import pytest

from app.resume.parser import (
    MIN_EXTRACTABLE_CHARS,
    ParsedResume,
    ResumeParseError,
    parse_resume_pdf,
    split_sections,
)
from tests.pdf_fixtures import (
    RESUME_A,
    make_scanned_pdf,
    make_text_pdf,
    make_truncated_pdf,
)


def test_parses_a_text_pdf():
    parsed = parse_resume_pdf(make_text_pdf(RESUME_A))
    assert isinstance(parsed, ParsedResume)
    assert parsed.page_count == 1
    assert "Loomweave" in parsed.text
    assert parsed.char_count == len(parsed.text)


def test_detects_resume_sections():
    parsed = parse_resume_pdf(make_text_pdf(RESUME_A))
    assert {"experience", "projects", "skills", "education"} <= set(parsed.sections)
    assert "Kafka" in parsed.sections["experience"]
    assert "Loomweave" in parsed.sections["projects"]


def test_content_before_the_first_heading_is_kept_as_header():
    parsed = parse_resume_pdf(make_text_pdf(RESUME_A))
    # Name and contact details precede every heading and are worth keeping.
    assert "Ada Lovelace" in parsed.sections["header"]


def test_section_headings_do_not_match_body_prose():
    # A sentence merely containing the word "experience" is not a heading.
    sections = split_sections(
        "SUMMARY\nI have five years of experience building systems.\nMore prose here."
    )
    assert set(sections) == {"summary"}
    assert "five years of experience" in sections["summary"]


def test_scanned_pdf_is_rejected_with_an_actionable_code():
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(make_scanned_pdf())
    assert exc.value.code == "no_text_layer"
    assert "scan" in exc.value.message.lower()


def test_truncated_pdf_is_rejected_rather_than_crashing():
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(make_truncated_pdf())
    assert exc.value.code in {"corrupt_pdf", "no_text_layer"}


def test_non_pdf_bytes_are_rejected_before_any_parsing():
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(b"PK\x03\x04 this is a docx, actually")
    assert exc.value.code == "not_a_pdf"


def test_empty_upload_is_rejected():
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(b"")
    assert exc.value.code == "empty_file"


def test_oversized_upload_is_rejected_without_parsing():
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(b"%PDF-1.4" + b"\0" * (6 * 1024 * 1024))
    assert exc.value.code == "too_large"


def test_a_pdf_with_only_a_few_characters_counts_as_no_text_layer():
    # Real scans leak a handful of stray glyphs, so the check is a threshold.
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(make_text_pdf(["ﬁ ﬂ"]))
    assert exc.value.code == "no_text_layer"


def test_text_just_over_the_threshold_is_accepted():
    line = "Built distributed systems in Rust and Go at scale. "
    lines = [line] * (MIN_EXTRACTABLE_CHARS // len(line) + 2)
    parsed = parse_resume_pdf(make_text_pdf(lines))
    assert parsed.char_count >= MIN_EXTRACTABLE_CHARS


def test_extraction_garbage_is_rejected_even_when_long():
    # Long output that is mostly symbols is broken extraction, not a resume.
    parsed_garbage = ["#$%^&*(){}[]<>~`|" * 4] * 6
    with pytest.raises(ResumeParseError) as exc:
        parse_resume_pdf(make_text_pdf(parsed_garbage))
    assert exc.value.code == "no_text_layer"
