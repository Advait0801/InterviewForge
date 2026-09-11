"""Synthetic PDFs for resume tests.

Built by hand rather than checked in as binaries. A committed .pdf is opaque --
nobody can tell from a diff whether it is a scan, an encrypted file or a valid
resume -- whereas these builders say exactly what they produce, and the
"scanned" case can be constructed precisely: a real page with a real image XObject
and no text-showing operator at all.
"""
from __future__ import annotations

from typing import List


def _pdf(objects: List[bytes], root_ref: int = 1) -> bytes:
    """Assemble numbered objects into a PDF with a correct xref table."""
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {root_ref} 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def make_text_pdf(lines: List[str]) -> bytes:
    """A one-page PDF whose text layer is exactly `lines`."""
    body = ["BT", "/F1 12 Tf", "14 TL", "40 750 Td"]
    for line in lines:
        body.append(f"({_escape(line)}) Tj")
        body.append("T*")
    body.append("ET")
    stream = "\n".join(body).encode("latin-1", "replace")

    return _pdf([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ])


def make_scanned_pdf() -> bytes:
    """A page containing only an image -- no text-showing operators.

    This is what a scan or a Canva-style export actually looks like to a parser:
    structurally valid, renders fine, extracts nothing.
    """
    image = bytes([255, 0, 0] * 16)  # 4x4 RGB
    stream = b"q 612 0 0 792 0 0 cm /Im1 Do Q"

    return _pdf([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB "
        b"/BitsPerComponent 8 /Length " + str(len(image)).encode() + b" >>\nstream\n"
        + image + b"\nendstream",
    ])


def make_truncated_pdf() -> bytes:
    """A PDF cut off mid-file -- the shape of an interrupted upload."""
    return make_text_pdf(["Some content that will be cut"])[:180]


RESUME_A = [
    "Ada Lovelace",
    "ada@example.com | github.com/ada",
    "",
    "EXPERIENCE",
    "Staff Engineer, Northwind Freight (2021-2025)",
    "Rebuilt the shipment tracking pipeline on Apache Kafka, cutting end-to-end",
    "latency from 40 seconds to under 2 seconds for 4 million daily events.",
    "Led a team of six through the migration off a monolithic Oracle scheduler.",
    "",
    "PROJECTS",
    "Loomweave - a distributed job scheduler written in Rust with a Raft-based",
    "control plane, used to run 200k nightly ETL tasks with exactly-once delivery.",
    "Sparrowlog - an append-only log store with an LSM-tree backend and a",
    "custom compaction policy tuned for write-heavy telemetry workloads.",
    "",
    "SKILLS",
    "Rust, Go, Python, Kafka, PostgreSQL, Kubernetes, Terraform, gRPC",
    "",
    "EDUCATION",
    "BSc Computer Science, University of Manchester",
]

RESUME_B = [
    "Grace Hopper",
    "grace@example.com | linkedin.com/in/grace",
    "",
    "EXPERIENCE",
    "Senior iOS Engineer, Tidewater Health (2019-2025)",
    "Shipped a HIPAA-compliant patient messaging app in Swift used by 90,000",
    "clinicians, with end-to-end encryption and offline-first sync via CoreData.",
    "Cut cold-start time by 60% by restructuring the dependency graph.",
    "",
    "PROJECTS",
    "Harborlight - an on-device speech transcription tool built on CoreML,",
    "running Whisper-tiny quantised to 4 bits entirely offline on iPhone.",
    "Pebblesort - a SwiftUI photo organiser using perceptual hashing to cluster",
    "near-duplicate images without uploading anything to a server.",
    "",
    "SKILLS",
    "Swift, Objective-C, SwiftUI, CoreML, CoreData, Metal, XCTest",
    "",
    "EDUCATION",
    "MSc Computer Science, Yale University",
]
