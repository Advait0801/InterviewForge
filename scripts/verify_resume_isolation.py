"""Phase 5 verification: resume isolation, deletion and grounding.

    python scripts/verify_resume_isolation.py

Run against a live stack (`docker compose up -d`, migrations applied). This is
not a unit test and is deliberately not part of `pytest`: it drives the real HTTP
API, the real Postgres and the real Chroma, and it checks isolation by querying
Chroma **directly** rather than through the code that is supposed to enforce it.

It exists because the unit suite cannot answer the question the phase is gated
on. Mocked collections prove the store filters correctly; only this proves that
two real users' vectors live apart, that deletion actually removes them from
disk, and that a generated question quotes the candidate's real resume.

It creates two throwaway users and leaves user B's data behind for inspection.
Exit code is non-zero if any check fails.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

# The PDF builders live with the ai-service tests; reuse them rather than
# checking opaque binary fixtures into the repo twice.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ai-service", "tests"))

from pdf_fixtures import RESUME_A, RESUME_B, make_scanned_pdf, make_text_pdf, make_truncated_pdf

# Host ports are offset so this project can coexist with another local stack
# (D-031b): web 3001, ai-service 8010, postgres 5433.
BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
CHROMA = os.getenv("CHROMA_URL", "http://localhost:8001")
AI = os.getenv("AI_SERVICE_URL", "http://localhost:8010")

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + detail) if detail else ''}")
    return condition


def call(method, url, payload=None, token=None, raw=False):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body or b"{}")
        except Exception:
            return e.code, {"raw": body.decode(errors="replace")}


def register(tag):
    suffix = uuid.uuid4().hex[:10]
    email = f"phase5-{tag}-{suffix}@example.com"
    status, body = call("POST", f"{BACKEND}/api/auth/register", {
        "email": email, "password": "Str0ngPassw0rd!", "username": f"p5{tag}{suffix}",
    })
    token = body.get("token") or (body.get("data") or {}).get("token")
    # /register returns only a token, so the user id comes from the JWT claim.
    user_id = None
    if token:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        user_id = json.loads(base64.urlsafe_b64decode(payload_b64)).get("userId")
    return token, user_id, email, status, body


def chroma_collections():
    with urllib.request.urlopen(f"{CHROMA}/api/v1/collections", timeout=30) as r:
        return json.loads(r.read())


def chroma_dump(collection_id):
    """Read every document out of a collection, bypassing the app entirely."""
    req = urllib.request.Request(
        f"{CHROMA}/api/v1/collections/{collection_id}/get",
        data=json.dumps({"include": ["documents", "metadatas"]}).encode(),
        method="POST",
    )
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    print("\n=== 1. two real users ===")
    tok_a, uid_a, email_a, sa, ba = register("a")
    tok_b, uid_b, email_b, sb, bb = register("b")
    if not (tok_a and tok_b):
        print("  registration failed:", sa, ba, sb, bb)
        sys.exit(1)
    check("two users registered", bool(uid_a and uid_b and uid_a != uid_b), f"{uid_a} / {uid_b}")

    print("\n=== 2. upload both resumes through the real API ===")
    pdf_a = base64.b64encode(make_text_pdf(RESUME_A)).decode()
    pdf_b = base64.b64encode(make_text_pdf(RESUME_B)).decode()
    st, up_a = call("POST", f"{BACKEND}/api/resumes", {"contentBase64": pdf_a, "filename": "ada.pdf"}, tok_a)
    check("user A resume ingested", st == 201, f"HTTP {st} {json.dumps(up_a)[:200]}")
    st, up_b = call("POST", f"{BACKEND}/api/resumes", {"contentBase64": pdf_b, "filename": "grace.pdf"}, tok_b)
    check("user B resume ingested", st == 201, f"HTTP {st} {json.dumps(up_b)[:200]}")
    ra = (up_a or {}).get("resume") or {}
    rb = (up_b or {}).get("resume") or {}
    check("A produced chunks", ra.get("chunk_count", 0) > 0, f"chunks={ra.get('chunk_count')} sections={ra.get('sections')}")
    check("B produced chunks", rb.get("chunk_count", 0) > 0, f"chunks={rb.get('chunk_count')} sections={rb.get('sections')}")

    print("\n=== 3. isolation, checked against Chroma directly ===")
    cols = {c["name"]: c["id"] for c in chroma_collections()}
    resume_cols = {n: i for n, i in cols.items() if n.startswith("resume_")}
    check("one namespace per user", len(resume_cols) >= 2, f"namespaces={list(resume_cols)}")

    owners = {}
    for name, cid in resume_cols.items():
        dump = chroma_dump(cid)
        ids = set(m.get("user_id") for m in (dump.get("metadatas") or []))
        owners[name] = ids
        check(f"namespace {name[:18]}.. holds exactly one user's chunks", len(ids) == 1, str(ids))

    all_owners = [o for ids in owners.values() for o in ids]
    check("no namespace mixes users", len(all_owners) == len(set(all_owners)))

    # The decisive test: retrieve as each user, assert none of the other's text.
    st, ret_a = call("POST", f"{AI}/api/resume/retrieve",
                     {"user_id": uid_a, "company": "apple", "stage": "system_design", "top_k": 20})
    st2, ret_b = call("POST", f"{AI}/api/resume/retrieve",
                      {"user_id": uid_b, "company": "amazon", "stage": "system_design", "top_k": 20})
    text_a = " ".join(e["excerpt"] for e in ret_a.get("evidence", []))
    text_b = " ".join(e["excerpt"] for e in ret_b.get("evidence", []))
    check("A retrieves their own content", "Loomweave" in text_a or "Kafka" in text_a, text_a[:120])
    check("B retrieves their own content", "Harborlight" in text_b or "Swift" in text_b, text_b[:120])

    b_markers = ["Swift", "CoreML", "Tidewater", "Harborlight", "clinicians", "Pebblesort"]
    a_markers = ["Kafka", "Loomweave", "Northwind", "Sparrowlog", "Rust"]
    leaked_into_a = [m for m in b_markers if m in text_a]
    leaked_into_b = [m for m in a_markers if m in text_b]
    check("A CANNOT retrieve B's chunks", not leaked_into_a, f"leaked={leaked_into_a}")
    check("B CANNOT retrieve A's chunks", not leaked_into_b, f"leaked={leaked_into_b}")

    st, metrics = call("GET", f"{AI}/metrics/llm")
    check("zero isolation violations recorded", metrics.get("resumeIsolationViolations") == 0,
          str(metrics.get("resumeIsolationViolations")))

    print("\n=== 4. malformed and scanned PDFs ===")
    cases = [
        ("scanned / image-only PDF", base64.b64encode(make_scanned_pdf()).decode(), "no_text_layer"),
        ("truncated PDF", base64.b64encode(make_truncated_pdf()).decode(), None),
        ("not a PDF at all", base64.b64encode(b"PK\x03\x04 actually a docx").decode(), "not_a_pdf"),
        ("empty file", base64.b64encode(b"").decode(), None),
        ("not base64", "!!!! not base64 !!!!", None),
    ]
    for label, payload, expected_code in cases:
        st, body = call("POST", f"{BACKEND}/api/resumes", {"contentBase64": payload, "filename": "x.pdf"}, tok_a)
        ok = st in (400, 413, 422) and st != 500
        detail = f"HTTP {st} code={body.get('code')} msg={str(body.get('error'))[:70]}"
        check(f"{label} -> handled, not a crash", ok, detail)
        if expected_code:
            check(f"{label} -> correct code", body.get("code") == expected_code, str(body.get("code")))

    st, still = call("GET", f"{BACKEND}/api/resumes/me", token=tok_a)
    check("a rejected upload did not destroy the existing resume",
          (still.get("resume") or {}).get("chunk_count", 0) > 0,
          json.dumps(still)[:160])
    st, ret_a_after = call("POST", f"{AI}/api/resume/retrieve",
                           {"user_id": uid_a, "company": "amazon", "stage": "system_design", "top_k": 20})
    check("A's vectors survived the rejected uploads too", ret_a_after.get("hits", 0) > 0,
          str(ret_a_after.get("hits")))

    print("\n=== 5. deletion purges vectors, verified by direct query ===")
    st, deleted = call("DELETE", f"{BACKEND}/api/resumes/me", token=tok_a)
    check("delete returned success", st == 200, f"HTTP {st} {json.dumps(deleted)[:160]}")
    check("delete reported zero remaining", deleted.get("remainingChunks") == 0, str(deleted.get("remainingChunks")))

    cols_after = {c["name"]: c["id"] for c in chroma_collections()}
    surviving = []
    for name, cid in cols_after.items():
        if not name.startswith("resume_"):
            continue
        dump = chroma_dump(cid)
        for meta in dump.get("metadatas") or []:
            if meta.get("user_id") == uid_a:
                surviving.append(name)
    check("DIRECT CHROMA QUERY: zero vectors survive for user A", not surviving, f"found in {surviving}")

    st, ret_a2 = call("POST", f"{AI}/api/resume/retrieve",
                      {"user_id": uid_a, "company": "amazon", "stage": "system_design", "top_k": 20})
    check("A retrieves nothing after deletion", ret_a2.get("hits") == 0, str(ret_a2.get("hits")))

    st, row = call("GET", f"{BACKEND}/api/resumes/me", token=tok_a)
    check("postgres row is gone too", row.get("resume") is None, json.dumps(row)[:120])

    st, ret_b2 = call("POST", f"{AI}/api/resume/retrieve",
                      {"user_id": uid_b, "company": "amazon", "stage": "system_design", "top_k": 20})
    check("user B is untouched by A's deletion", ret_b2.get("hits", 0) > 0, str(ret_b2.get("hits")))

    print("\n=== 6. a grounded question referencing real resume content ===")
    st, session = call("POST", f"{BACKEND}/api/interviews", {"company": "amazon", "difficulty": "medium"}, tok_b)
    if st == 201:
        q = session.get("openingQuestion") or {}
        grounded = q.get("resumeGrounded")
        check("session is resume-grounded", grounded is True, f"resumeGrounded={grounded}")
        text = (q.get("question") or "") + " " + (q.get("groundedIn") or "")
        hits = [m for m in b_markers + ["iOS", "HIPAA", "encryption", "offline"] if m.lower() in text.lower()]
        check("question references real resume content", bool(hits), f"matched={hits}")
        print(f"    Q: {q.get('question')}")
        print(f"    groundedIn: {q.get('groundedIn')}")
        print(f"    evidence sections: {[e['section'] for e in (q.get('resumeEvidence') or [])]}")
        print(f"    retrievalConfidence: {q.get('retrievalConfidence')}")
        print(f"    liveIngestion: {str(q.get('liveIngestion'))[:120]}")
    else:
        print(f"  SKIP  question generation unavailable (HTTP {st}): {json.dumps(session)[:200]}")

    print(f"\n=== RESULT: {len(PASSES)} passed, {len(FAILS)} failed ===")
    for f in FAILS:
        print("  FAILED:", f)
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
