"""Group C, Phase 9 verification: interview replay, public share links, assessment proctoring (D-071).

    python scripts/verify_sharing.py

Run against a live stack (`docker compose up -d`, migration 018 applied). No model calls: the
interviews it shares are written straight into Postgres (`docker compose exec postgres`), with
every private field holding the string CANARY, so the check doesn't have to pay for a real
interview to prove nothing private gets out. Registers two throwaway users.

What it checks, through the real HTTP API and Postgres:
  1. Replay: the owner's timeline is canary-free; another user gets 404.
  2. Links: 409 until the interview has a stored report; 201 with a 43-character token whose
     SHA-256, not the token, is stored; 409 past 5 active links; another user can't list or
     revoke them.
  3. Public page: anyone with the link, signed in or not, gets the same canary-free body as the
     owner's preview, with no-store / noindex / no-referrer headers, and the view is counted.
     Opening it makes no model call (the ai-service's call counter doesn't move).
  4. Revoked, expired, unknown and malformed links: the same 404.
  5. Proctoring: events recorded and summarised with flags; pasted text refused; another
     user's assessment 404; the summary on the assessment and its submit result; no events
     after submitting.
  6. No `openapi_violation` in the backend log for this run.
Exit code is non-zero if any check fails.
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
AI = os.getenv("AI_SERVICE_URL", "http://localhost:8010")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CANARY = "CANARY"

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + str(detail)[:300]) if detail else ''}")
    return condition


def request(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{BACKEND}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}"), dict(e.headers)


def call(method, path, payload=None, token=None):
    status, body, _ = request(method, path, payload, token)
    return status, body


def psql(sql):
    return subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "interviewforge", "-v", "ON_ERROR_STOP=1", "-tAc", sql],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout.strip()


def register(label):
    suffix = uuid.uuid4().hex[:10]
    _, body = call("POST", "/api/auth/register", {
        "email": f"p9{label}-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p9{label}{suffix}"[:20],
    })
    token = body["token"]
    payload = token.split(".")[1]
    return token, json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["userId"]


def lit(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def seed_interview(user_id, completed=True):
    """A finished, résumé-grounded interview with CANARY in every private field."""
    report = {
        "overallScore": 7,
        "stageScores": {"behavioral": {"score": 8, "feedback": "Clear STAR structure.", "x": f"{CANARY}-stage-extra"},
                        f"{CANARY}-stage": {"score": 1, "feedback": CANARY}},
        "strengths": ["Communicates well"], "weaknesses": ["Rushed"], "recommendations": ["Estimate capacity"],
        "graderNotes": f"{CANARY}-report-extra",
    }
    session_id = psql(
        "INSERT INTO interview_sessions (user_id, company, current_stage, status, resume_grounded, persona, mode, llm_calls, llm_cost_usd, report_json, created_at) "
        f"VALUES ('{user_id}', 'google', 'core_cs', '{'completed' if completed else 'active'}', true, 'friendly', 'agent', 23, 0.0041, "
        f"{lit(report) if completed else 'NULL'}, NOW() - INTERVAL '20 minutes') RETURNING id"
    ).splitlines()[0]
    rows = [
        ("assistant", "Tell me about a project you led.", 0, {
            "kind": "question", "company": "google", "stage": "behavioral", "reasoningFocus": f"{CANARY}-focus",
            "expectedCompetencies": [f"{CANARY}-c"], "context": f"{CANARY}-retrieved-context", "resumeGrounded": True,
            "groundedIn": f"{CANARY}-grounded", "resumeEvidence": [{"section": "experience", "excerpt": f"{CANARY}-resume-excerpt", "distance": 0.2}],
            "retrievalConfidence": {"confident": True, "reason": f"{CANARY}-conf", "top_distance": 0.1, "good_hits": 3, "company_matched": True},
            "liveIngestion": {"triggered": True, "reason": "thin", "urls_considered": [f"https://{CANARY}.example.com"]},
            "agent": {"decided": "advance", "rationale": f"{CANARY}-rationale", "steps": 2, "searches": 1}}),
        ("candidate", "I led the payments migration.", 95, {"kind": "answer"}),
        ("system", f"{CANARY}-eval-content", 100, {
            "kind": "evaluation", "score": 6, "strengths": ["Concrete"], "weaknesses": ["No metrics"], "suggestions": ["Quantify"],
            "shouldAskFollowup": True, "followupFocus": f"{CANARY}-ff", "extra": f"{CANARY}-eval-extra"}),
        ("assistant", "You said a week; the doc says a quarter?", 110, {
            "kind": "followup", "focus": f"{CANARY}-f", "reason": f"{CANARY}-r", "challenge": {"claim": f"{CANARY}-claim", "evidence": f"{CANARY}-evidence"}}),
        ("system", f"{CANARY}-unknown", 140, {"kind": "audit", "note": f"{CANARY}-audit"}),
    ]
    for role, content, offset, meta in rows:
        psql(
            "INSERT INTO interview_messages (session_id, role, stage, content, metadata_json, created_at) "
            f"VALUES ('{session_id}', '{role}', 'behavioral', '{content.replace(chr(39), chr(39) * 2)}', {lit(meta)}, "
            f"NOW() - INTERVAL '20 minutes' + INTERVAL '{offset} seconds')"
        )
    return session_id


def private_leaks(body, ids):
    text = json.dumps(body)
    leaks = [w for w in [CANARY, "0.0041", *[f'"{i}"' for i in ids]] if w in text]
    return leaks


def model_calls():
    """The ai-service's running count of model calls."""
    return json.loads(urllib.request.urlopen(f"{AI}/metrics/llm", timeout=10).read())["calls"]


def main():
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    alice, alice_id = register("a")
    bob, bob_id = register("b")
    session_id = seed_interview(alice_id)
    unfinished = seed_interview(alice_id, completed=False)
    ids = [session_id, alice_id, bob_id]

    print("\n1. Replay")
    status, replay = call("GET", f"/api/interviews/{session_id}/replay", token=alice)
    check("the owner's replay: 200, timeline in order", status == 200 and [e["type"] for e in replay["events"]] == ["question", "answer", "evaluation", "followup"],
          [e["type"] for e in replay.get("events", [])])
    check("nothing private in it (CANARY, ids, cost)", status == 200 and not private_leaks(replay, ids), private_leaks(replay, ids))
    check("another user: 404", call("GET", f"/api/interviews/{session_id}/replay", token=bob)[0] == 404)

    print("\n2. Links")
    status, body = call("POST", f"/api/interviews/{unfinished}/share", {}, alice)
    check("no stored report yet: 409 report_not_ready", status == 409 and body.get("code") == "report_not_ready", body)
    status, created = call("POST", f"/api/interviews/{session_id}/share", {"displayName": "Ada L.", "expiresInDays": 30}, alice)
    token = created.get("token", "")
    check("201 with a 43-character token", status == 201 and len(token) == 43, status)
    stored = psql(f"SELECT token_hash FROM interview_share_links WHERE session_id = '{session_id}'")
    check("only its SHA-256 is stored", stored == hashlib.sha256(token.encode()).hexdigest()
          and psql(f"SELECT COUNT(*) FROM interview_share_links WHERE token_hash = '{token}' OR token_hint = '{token}'") == "0")
    check("Bob can't list Alice's links", call("GET", f"/api/interviews/{session_id}/share", token=bob)[0] == 404)
    link_id = created["link"]["id"]
    check("...or revoke one", call("DELETE", f"/api/interviews/{session_id}/share/{link_id}", token=bob)[0] == 404)

    print("\n3. The public page")
    before = model_calls()
    status, page, headers = request("GET", f"/api/public/interviews/{token}")
    lower = {k.lower(): v for k, v in headers.items()}
    check("anyone with the link: 200", status == 200, status)
    check("nothing private (CANARY, ids, cost)", not private_leaks(page, ids), private_leaks(page, ids))
    check("exactly the owner's preview, plus the chosen name", page == {"candidate": "Ada L.", **replay}, set(page) ^ set(replay))
    check("no-store, noindex, no-referrer",
          lower.get("cache-control") == "no-store" and lower.get("x-robots-tag") == "noindex, nofollow" and lower.get("referrer-policy") == "no-referrer",
          {k: lower.get(k) for k in ["cache-control", "x-robots-tag", "referrer-policy"]})
    _, as_bob, _ = request("GET", f"/api/public/interviews/{token}", token=bob)
    check("the same for a signed-in viewer", as_bob == page)
    check("opening it made no model call", model_calls() == before, (before, model_calls()))
    check("views are counted", psql(f"SELECT view_count FROM interview_share_links WHERE id = '{link_id}'") == "2")

    print("\n4. Links that don't work")
    not_found = request("GET", f"/api/public/interviews/{'A' * 43}")
    malformed = request("GET", "/api/public/interviews/nope")
    _, second = call("POST", f"/api/interviews/{session_id}/share", {}, alice)
    psql(f"UPDATE interview_share_links SET expires_at = NOW() - INTERVAL '1 second' WHERE id = '{second['link']['id']}'")
    expired = request("GET", f"/api/public/interviews/{second['token']}")
    check("revoke: 200", call("DELETE", f"/api/interviews/{session_id}/share/{link_id}", token=alice)[0] == 200)
    revoked = request("GET", f"/api/public/interviews/{token}")
    check("revoked, expired, unknown, malformed: the same 404",
          all(r[0] == 404 and r[1] == not_found[1] for r in [revoked, expired, malformed]), [r[0] for r in [revoked, expired, malformed]])
    check("the list shows neither", call("GET", f"/api/interviews/{session_id}/share", token=alice)[1].get("links") == [])
    for _ in range(5):
        call("POST", f"/api/interviews/{session_id}/share", {}, alice)
    status, body = call("POST", f"/api/interviews/{session_id}/share", {}, alice)
    check("a sixth active link: 409 too_many_links", status == 409 and body.get("code") == "too_many_links", body)

    print("\n5. Proctoring")
    status, created = call("POST", "/api/assessments", {"problemCount": 1, "timeLimitMinutes": 30, "difficultyMix": "easy"}, alice)
    aid = created.get("assessmentId")
    now = datetime.now(timezone.utc)
    ts = lambda s: (now - timedelta(seconds=s)).isoformat().replace("+00:00", "Z")
    events = [{"type": "tab_hidden", "at": ts(30)}, {"type": "tab_visible", "at": ts(25)},
              {"type": "tab_hidden", "at": ts(20)}, {"type": "tab_visible", "at": ts(18)},
              {"type": "tab_hidden", "at": ts(15)}, {"type": "tab_visible", "at": ts(14)},
              {"type": "paste", "at": ts(10), "chars": 312}, {"type": "window_blur", "at": ts(5)}]
    status, body = call("POST", f"/api/assessments/{aid}/events", {"events": events}, alice)
    integ = body.get("integrity", {})
    check("events recorded and summarised", status == 201 and body.get("recorded") == 8 and integ.get("tabSwitches") == 3
          and integ.get("hiddenSeconds") == 8 and integ.get("largestPaste") == 312, integ)
    check("flags: 3 tab switches, a 312-character paste", integ.get("flags") == ["Left the tab 3 times", "Pasted 312 characters at once"], integ.get("flags"))
    status, body = call("POST", f"/api/assessments/{aid}/events", {"events": [{"type": "paste", "at": ts(1), "chars": 3, "text": "abc"}]}, alice)
    check("pasted text is refused (400), not stored", status == 400 and psql(f"SELECT COUNT(*) FROM assessment_events WHERE assessment_id = '{aid}'") == "8", body)
    check("Bob can't post to Alice's assessment (404)", call("POST", f"/api/assessments/{aid}/events", {"events": events[:1]}, bob)[0] == 404)
    _, detail = call("GET", f"/api/assessments/{aid}", token=alice)
    check("the summary is on the assessment", detail.get("integrity", {}).get("events") == 8)
    status, result = call("POST", f"/api/assessments/{aid}/submit", {}, alice)
    check("...and on the submit result", status == 200 and result.get("integrity", {}).get("tabSwitches") == 3, result.get("integrity"))
    status, body = call("POST", f"/api/assessments/{aid}/events", {"events": [{"type": "window_blur", "at": ts(0)}]}, alice)
    check("no events after submitting (409 assessment_closed)", status == 409 and body.get("code") == "assessment_closed", body)

    print("\n6. Contract")
    logs = subprocess.run(["docker", "compose", "logs", "--since", started, "backend"], cwd=ROOT, capture_output=True, text=True).stdout
    check("no openapi_violation in the backend log for this run", logs.count("openapi_violation") == 0, logs.count("openapi_violation"))

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
