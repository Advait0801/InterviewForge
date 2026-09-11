"""PDF resume parsing.

Parsing is deliberately defensive. A resume is the one file in this system that
arrives from an untrusted user as a binary blob, and the realistic inputs are
worse than the happy path suggests: exports from Word with broken xrefs,
password-protected PDFs, and -- most commonly -- resumes that are a *scan* or a
Canva-style export where every "word" is a glyph outline with no extractable
text layer at all.

Each of those has to produce a clear, actionable failure rather than a 500 or,
worse, a successful ingest of ten characters of noise. `ResumeParseError`
carries a machine-readable `code` so the HTTP layer can map it to a status and
the UI can say something useful.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# A scanned page usually yields a handful of stray ligature characters rather
# than literally nothing, so "no text layer" has to be a threshold, not `== 0`.
MIN_EXTRACTABLE_CHARS = 200
# Enough alphabetic content to be prose rather than extraction garbage.
MIN_ALPHA_RATIO = 0.5
MAX_PAGES = 15
MAX_BYTES = 5 * 1024 * 1024

PDF_MAGIC = b"%PDF-"


class ResumeParseError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# Section headings a resume actually uses. Matched case-insensitively against a
# short standalone line -- headings are their own line, body text is not.
_SECTION_PATTERNS: List[tuple] = [
    ("experience", r"(work\s+)?experience|employment|professional\s+background"),
    ("projects", r"projects?|personal\s+projects|selected\s+work"),
    ("education", r"education|academics?"),
    ("skills", r"(technical\s+)?skills|technologies|tech\s+stack"),
    ("publications", r"publications?|research|papers"),
    ("awards", r"awards?|honou?rs|achievements"),
    ("summary", r"summary|objective|profile|about"),
    ("certifications", r"certifications?|licen[cs]es"),
    ("leadership", r"leadership|activities|volunteering"),
]
_SECTION_RES = [(name, re.compile(rf"^\W*(?:{pattern})\W*$", re.I)) for name, pattern in _SECTION_PATTERNS]

_HEADING_MAX_WORDS = 4


@dataclass
class ParsedResume:
    text: str
    page_count: int
    char_count: int
    sections: Dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "page_count": self.page_count,
            "char_count": self.char_count,
            "sections": sorted(self.sections.keys()),
        }


def _looks_like_heading(line: str) -> Optional[str]:
    stripped = line.strip()
    if not stripped or len(stripped.split()) > _HEADING_MAX_WORDS:
        return None
    for name, pattern in _SECTION_RES:
        if pattern.match(stripped):
            return name
    return None


def split_sections(text: str) -> Dict[str, str]:
    """Group lines under the resume section heading that precedes them.

    Everything before the first recognised heading is `header` -- that is where
    the name, contact details and often a one-line summary live, and it is worth
    keeping rather than discarding as pre-amble.
    """
    sections: Dict[str, List[str]] = {}
    current = "header"
    for line in text.splitlines():
        heading = _looks_like_heading(line)
        if heading:
            current = heading
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)

    out: Dict[str, str] = {}
    for name, lines in sections.items():
        body = "\n".join(lines).strip()
        if body:
            out[name] = body
    return out


def _alpha_ratio(text: str) -> float:
    meaningful = [c for c in text if not c.isspace()]
    if not meaningful:
        return 0.0
    return sum(c.isalpha() for c in meaningful) / len(meaningful)


def _normalise(text: str) -> str:
    # PDF extraction leaves NULs, soft hyphens and runs of blank lines that add
    # nothing but chunk size.
    text = text.replace("\x00", "").replace("­", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_resume_pdf(data: bytes) -> ParsedResume:
    """Extract text and sections from a PDF, or raise ResumeParseError."""
    if not data:
        raise ResumeParseError("empty_file", "The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise ResumeParseError(
            "too_large", f"Resume exceeds the {MAX_BYTES // (1024 * 1024)}MB limit."
        )
    if not data.lstrip()[:1024].startswith(PDF_MAGIC):
        raise ResumeParseError(
            "not_a_pdf", "That file is not a PDF. Export your resume as PDF and try again."
        )

    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
    except PdfReadError as exc:
        raise ResumeParseError("corrupt_pdf", f"The PDF could not be read: {exc}")
    except Exception as exc:  # pypdf raises assorted types on malformed input
        raise ResumeParseError("corrupt_pdf", f"The PDF could not be read: {exc}")

    if getattr(reader, "is_encrypted", False):
        # An empty user password is common in "protected" exports and decrypts
        # silently; a real password cannot be recovered, so say so plainly.
        try:
            if reader.decrypt("") == 0:
                raise ResumeParseError(
                    "encrypted_pdf",
                    "The PDF is password-protected. Remove the password and re-upload.",
                )
        except ResumeParseError:
            raise
        except Exception:
            raise ResumeParseError(
                "encrypted_pdf",
                "The PDF is password-protected. Remove the password and re-upload.",
            )

    pages = reader.pages
    if len(pages) == 0:
        raise ResumeParseError("corrupt_pdf", "The PDF contains no pages.")
    if len(pages) > MAX_PAGES:
        raise ResumeParseError(
            "too_many_pages", f"Resumes are limited to {MAX_PAGES} pages; this has {len(pages)}."
        )

    extracted: List[str] = []
    for page in pages:
        try:
            extracted.append(page.extract_text() or "")
        except Exception:
            # One unreadable page should not lose the rest of the document.
            extracted.append("")

    text = _normalise("\n".join(extracted))

    if len(text) < MIN_EXTRACTABLE_CHARS:
        raise ResumeParseError(
            "no_text_layer",
            "No text could be extracted -- this looks like a scanned or image-only PDF. "
            "Upload a PDF exported from a text editor rather than a scan or photo.",
        )
    if _alpha_ratio(text) < MIN_ALPHA_RATIO:
        raise ResumeParseError(
            "no_text_layer",
            "The extracted text is not readable -- this looks like a scanned or "
            "image-only PDF. Upload a text-based PDF instead.",
        )

    return ParsedResume(
        text=text,
        page_count=len(pages),
        char_count=len(text),
        sections=split_sections(text),
    )
