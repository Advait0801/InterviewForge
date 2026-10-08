"""Phase 4 verification: interview questions streamed ai-service -> Express -> client (D-065).

    python scripts/verify_streaming.py

Run against a live stack (`docker compose up -d`, migrations applied). It makes real model
calls -- about a dozen cheap ones (two interviews' worth) -- and registers one throwaway user.

What it checks, through the real HTTP API and real Postgres:
  1. Both hops stream: text arrives in pieces before `done`, at the ai-service and through
     Express; timings are printed next to the JSON endpoint's. For numbers worth quoting use
     `--measure N`: N interleaved JSON/stream pairs at the ai-service, medians reported.
  2. The event sequence and `done` body match the JSON endpoints' contract, and the stored
     transcript matches what was streamed.
  3. A client that leaves mid-question records nothing, the ai-service logs the model stream
     as cancelled, and the same answer can then be sent again.
  4. Two simultaneous answers to one turn: one `done`, one non-retryable 409 `error`.
  5. A client that pauses mid-stream still gets a complete, valid stream when it resumes.
  6. Input errors stay plain JSON (400/404) with no stream.
Exit code is non-zero if any check fails.
"""
import base64
import http.client
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
AI = os.getenv("AI_SERVICE_URL", "http://localhost:8010")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + detail) if detail else ''}")
    return condition


def call(method, url, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class Stream:
    """One streamed POST, read event by event, with timings relative to the request."""

    def __init__(self, base, path, payload, token=None):
        url = urllib.parse.urlparse(base)
        self.conn = http.client.HTTPConnection(url.hostname, url.port, timeout=180)
        headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.start = time.perf_counter()
        self.conn.request("POST", path, body=json.dumps(payload), headers=headers)
        self.response = self.conn.getresponse()
        self.headers_ms = self.ms()
        self.status = self.response.status
        self.content_type = self.response.getheader("Content-Type", "")
        self.events, self.times = [], []

    def ms(self):
        return round((time.perf_counter() - self.start) * 1000)

    def json(self):
        return json.loads(self.response.read() or b"{}")

    def __iter__(self):
        block = []
        while True:
            line = self.response.readline()
            if not line:
                return
            line = line.decode().rstrip("\r\n")
            if line:
                block.append(line)
                continue
            fields = dict(l.split(": ", 1) for l in block if not l.startswith(":") and ": " in l)
            block = []
            if "data" not in fields:
                continue
            event = json.loads(fields["data"])
            assert fields.get("event") == event["type"], fields
            self.events.append(event)
            self.times.append(self.ms())
            yield event

    def read_all(self):
        for _ in self:
            pass
        self.conn.close()
        return self.events

    def drop(self):
        """Leave abruptly, as a closed tab would."""
        self.conn.sock.shutdown(socket.SHUT_RDWR)
        self.conn.close()

    def first(self, kind):
        return next((t for e, t in zip(self.events, self.times) if e["type"] == kind), None)


def register():
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", f"{BACKEND}/api/auth/register", {
        "email": f"phase4-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p4{suffix}",
    })
    return body.get("token")


def messages(token, session_id):
    status, body = call("GET", f"{BACKEND}/api/interviews/{session_id}", token=token)
    return body.get("session", {}), body.get("messages", [])


def cancelled_streams():
    return call("GET", f"{AI}/metrics/llm")[1].get("cancelled", 0)


def logs_since(service, since):
    try:
        out = subprocess.run(
            ["docker", "compose", "logs", "--no-log-prefix", "--since", since, service],
            cwd=ROOT, capture_output=True, text=True, timeout=30,
        )
        return out.stdout + out.stderr
    except Exception as exc:  # docker CLI missing: report rather than crash
        return f"(could not read logs: {exc})"


def deltas(events):
    return "".join(e["text"] for e in events if e["type"] == "delta")


def main():
    token = register()
    if not check("registered a throwaway user", bool(token)):
        return

    print("\n1. Both hops stream (timings in ms)")
    payload = {"company": "amazon", "stage": "coding", "difficulty": "medium"}
    t0 = time.perf_counter()
    status, plain = call("POST", f"{AI}/api/interview/next-question", payload)
    json_ms = round((time.perf_counter() - t0) * 1000)
    hop1 = Stream(AI, "/api/interview/next-question/stream", payload)
    hop1.read_all()
    print(f"     ai-service  JSON total {json_ms} | stream first delta {hop1.first('delta')}, done {hop1.first('done')}")
    check("ai-service stream: deltas, then done", [e["type"] for e in hop1.events][-1] == "done"
          and sum(e["type"] == "delta" for e in hop1.events) >= 3,
          f"{sum(e['type'] == 'delta' for e in hop1.events)} deltas")
    check("ai-service stream: text arrives before done", hop1.first("delta") is not None and hop1.first("delta") < hop1.first("done"))
    done = hop1.events[-1]["result"]
    check("ai-service stream: done has the JSON endpoint's keys", set(done) == set(plain), str(set(done) ^ set(plain)))
    check("ai-service stream: deltas spell the final question", deltas(hop1.events) == done["question"])

    t0 = time.perf_counter()
    status, started_json = call("POST", f"{BACKEND}/api/interviews", {"company": "google"}, token)
    start_json_ms = round((time.perf_counter() - t0) * 1000)
    start = Stream(BACKEND, "/api/interviews/stream", {"company": "google"}, token)
    check("Express start stream: 200 text/event-stream",
          start.status == 200 and start.content_type.startswith("text/event-stream"), start.content_type)
    check("Express start stream: proxy buffering off", start.response.getheader("X-Accel-Buffering") == "no")
    events = start.read_all()
    types = [e["type"] for e in events]
    print(f"     Express     JSON total {start_json_ms} | headers {start.headers_ms}, "
          f"first delta {start.first('delta')}, done {start.first('done')}")
    check("Express start stream: question, deltas, done", types[0] == "question" and types[-1] == "done"
          and types.count("delta") >= 3, f"{types.count('delta')} deltas")
    check("Express start stream: text arrives before done", start.first("delta") is not None and start.first("delta") < start.first("done"))
    result = events[-1]["result"]
    check("Express start stream: done has POST /interviews' shape", set(result) == set(started_json)
          and set(result["session"]) == set(started_json["session"]))
    session_id = result["session"]["id"]
    session, msgs = messages(token, session_id)
    check("stored opening question is exactly what was streamed",
          len(msgs) == 1 and msgs[0]["content"] == result["openingQuestion"]["question"] == deltas(events))

    print("\n2. Answer turn streamed")
    turn = Stream(BACKEND, f"/api/interviews/{session_id}/answer/stream",
                  {"answer": "I once rewrote a slow batch job as a streaming pipeline and cut latency by 80%."}, token)
    events = turn.read_all()
    types = [e["type"] for e in events]
    print(f"     evaluation {turn.first('evaluation')}, first delta {turn.first('delta')}, done {turn.first('done')}")
    check("answer stream: evaluation first, done last", types[0] == "evaluation" and types[-1] == "done", str(types[:3]))
    outcome = events[-1]["result"]
    if outcome["action"] != "completed":
        check("answer stream: deltas spell the next question", deltas(events) == outcome["nextQuestion"]["question"])
    session, msgs = messages(token, session_id)
    check("answer stream: the turn is stored (answer, evaluation, question)", len(msgs) == 4, f"{len(msgs)} messages")

    print("\n3. Disconnect mid-question")
    # (a) At the ai-service: leaving after the first chunk must stop the model stream.
    before_cancelled = cancelled_streams()
    direct = Stream(AI, "/api/interview/next-question/stream", {"company": "uber", "stage": "system_design", "difficulty": "hard"})
    for event in direct:
        if event["type"] == "delta":
            direct.drop()
            break
    time.sleep(2)
    check("disconnect at the ai-service: the model stream is cancelled",
          cancelled_streams() > before_cancelled, f"cancelled {before_cancelled} -> {cancelled_streams()}")

    # (b) Through Express: it aborts its upstream call and records nothing. Gemini sends a
    # question in a few large chunks, so the model may already be done by then; whether it
    # was is reported, not required.
    before_session, before = messages(token, session_id)
    before_cancelled = cancelled_streams()
    since = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 1))
    answer = "I'd shard by user id and put a write-through cache in front of the hot partitions."
    leaving = Stream(BACKEND, f"/api/interviews/{session_id}/answer/stream", {"answer": answer}, token)
    left_after = None
    for event in leaving:
        if event["type"] == "delta":
            left_after = event
            leaving.drop()
            break
    if left_after is None:
        check("disconnect: got a delta to leave after", False, f"events: {[e['type'] for e in leaving.events]}")
    else:
        time.sleep(4)  # let both services notice and unwind
        after_session, after = messages(token, session_id)
        check("disconnect through Express: nothing recorded", len(after) == len(before)
              and after_session["stage_turn_count"] == before_session["stage_turn_count"]
              and after_session["current_stage"] == before_session["current_stage"])
        aborted = [l for l in logs_since("backend", since).splitlines()
                   if '"event":"ai_service_stream"' in l and '"outcome":"aborted"' in l]
        check("disconnect through Express: it aborted the upstream stream", len(aborted) == 1, aborted[0][:160] if aborted else "")
        print(f"     model still generating when the client left: {cancelled_streams() > before_cancelled}")
        again = Stream(BACKEND, f"/api/interviews/{session_id}/answer/stream", {"answer": answer}, token)
        again.read_all()
        check("disconnect: the same answer can be sent again", again.events and again.events[-1]["type"] == "done")

    print("\n4. Two simultaneous answers to one turn")
    session, msgs = messages(token, session_id)
    if session.get("status") == "active":
        results = []

        def send():
            s = Stream(BACKEND, f"/api/interviews/{session_id}/answer/stream", {"answer": "Use a heap of size k."}, token)
            results.append(s.read_all()[-1])

        threads = [threading.Thread(target=send) for _ in range(2)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()
        kinds = sorted(r["type"] for r in results)
        conflict = next((r for r in results if r["type"] == "error"), {})
        check("double submit: one done, one 409 error", kinds == ["done", "error"]
              and conflict.get("status") == 409 and conflict.get("retryable") is False, json.dumps(results)[:200])

    print("\n5. A client that pauses mid-stream")
    session, msgs = messages(token, session_id)
    if session.get("status") == "active":
        slow = Stream(BACKEND, f"/api/interviews/{session_id}/answer/stream", {"answer": "TCP retransmits on timeout."}, token)
        paused = False
        for event in slow:
            if event["type"] == "delta" and not paused:
                paused = True
                time.sleep(3)
        check("paused client: complete stream once it reads again",
              slow.events[-1]["type"] == "done" and (slow.events[-1]["result"]["action"] == "completed"
                                                    or deltas(slow.events) == slow.events[-1]["result"]["nextQuestion"]["question"]))

    print("\n6. Input errors stay JSON")
    bad = Stream(BACKEND, "/api/interviews/stream", {"company": "enron"}, token)
    check("unknown company: 400 JSON", bad.status == 400 and bad.content_type.startswith("application/json") and "error" in bad.json())
    missing = Stream(BACKEND, f"/api/interviews/{uuid.uuid4()}/answer/stream", {"answer": "x"}, token)
    check("unknown session: 404 JSON", missing.status == 404 and missing.content_type.startswith("application/json"))

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    if FAILS:
        print("FAILED: " + "; ".join(FAILS))


def measure(n):
    """Interleaved pairs, same request, medians: JSON total vs stream first text and done.

    Paced to stay under the free tier's 15 requests/minute; a 429 retry inside the provider
    client would otherwise land in one side's timings.
    """
    import statistics

    payload = {"company": "amazon", "stage": "coding", "difficulty": "medium"}
    plain, first, done, chunks = [], [], [], []
    for i in range(n):
        t0 = time.perf_counter()
        call("POST", f"{AI}/api/interview/next-question", payload)
        plain.append(round((time.perf_counter() - t0) * 1000))
        time.sleep(4.5)
        s = Stream(AI, "/api/interview/next-question/stream", payload)
        s.read_all()
        first.append(s.first("delta"))
        done.append(s.first("done"))
        chunks.append(sum(e["type"] == "delta" for e in s.events))
        print(f"  pair {i + 1}: JSON {plain[-1]} | stream first text {first[-1]}, done {done[-1]}, {chunks[-1]} deltas")
        time.sleep(4.5)
    med = statistics.median
    print(f"\nmedians over {n}: JSON {med(plain)} ms | stream first text {med(first)} ms, done {med(done)} ms, "
          f"{med(chunks)} deltas")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--measure":
        measure(int(sys.argv[2]))
        sys.exit(0)
    main()
    sys.exit(1 if FAILS else 0)
