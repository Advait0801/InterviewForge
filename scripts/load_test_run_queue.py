"""Phase 3 load test: concurrent code runs never exceed the queue's cap (D-063).

    python scripts/load_test_run_queue.py --requests 20 --cap 4

Fires N simultaneous Run requests through the real backend, each executing a solution that
sleeps first so runs overlap, while a sampler counts live sandbox containers with
`docker ps` every 100 ms. The container count comes from Docker, not from the backend, so
it measures what code-runner actually started. Exits 1 if the peak exceeds --cap.

Run mode records no submissions. Needs the dev stack and the python sandbox image.
"""
import argparse
import json
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "http://localhost:4000/api"
SANDBOX = "interviewforge-python-sandbox:latest"
ROOT = Path(__file__).resolve().parents[1]


def call(method, path, body=None, token=None, timeout=180):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method)
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def live_sandboxes() -> int:
    out = subprocess.run(
        ["docker", "ps", "-q", "--filter", f"ancestor={SANDBOX}"], capture_output=True, text=True, check=True
    ).stdout
    return len(out.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--requests", type=int, default=20)
    ap.add_argument("--cap", type=int, default=4, help="expected CODE_RUN_CONCURRENCY")
    ap.add_argument("--sleep", type=float, default=1.5, help="seconds each run sleeps")
    ap.add_argument("--no-assert", action="store_true", help="report only (for a baseline run)")
    args = ap.parse_args()

    stamp = str(int(time.time()))
    _, reg = call("POST", "/auth/register", {"username": f"load{stamp}", "email": f"load{stamp}@example.invalid", "password": "LoadTest-1!"})
    token = reg["token"]
    _, listing = call("GET", "/problems?difficulty=easy")
    problem = next(p for p in listing["problems"] if p["slug"] == "two-sum")
    solution = (ROOT / "backend/reference_solutions/two-sum/solution.py").read_text()
    code = f"import time\ntime.sleep({args.sleep})\n{solution}"

    samples, stop = [], threading.Event()

    def sample():
        while not stop.is_set():
            samples.append(live_sandboxes())
            time.sleep(0.1)

    results = []

    def fire(i):
        t0 = time.time()
        status, body = call("POST", "/submissions", {"problemId": problem["id"], "language": "python3", "code": code, "mode": "run"}, token)
        results.append({"i": i, "status": status, "passed": body.get("passed"), "error": body.get("error"), "seconds": time.time() - t0})

    sampler = threading.Thread(target=sample)
    sampler.start()
    time.sleep(0.3)
    start = time.time()
    threads = [threading.Thread(target=fire, args=(i,)) for i in range(args.requests)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    wall = time.time() - start
    time.sleep(0.5)
    stop.set()
    sampler.join()

    peak = max(samples) if samples else 0
    statuses = {}
    for r in results:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    latencies = sorted(r["seconds"] for r in results)
    report = {
        "requests": args.requests,
        "statuses": statuses,
        "all_passed": all(r["passed"] for r in results if r["status"] == 200),
        "peak_live_sandboxes": peak,
        "cap": args.cap,
        "wall_seconds": round(wall, 1),
        "latency_p50": round(statistics.median(latencies), 1),
        "latency_max": round(latencies[-1], 1),
        "samples": len(samples),
        "errors": sorted({r["error"] for r in results if r["error"]}),
    }
    print(json.dumps(report, indent=2))
    if args.no_assert:
        return 0
    ok = peak <= args.cap and statuses.get(200, 0) == args.requests and report["all_passed"]
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
