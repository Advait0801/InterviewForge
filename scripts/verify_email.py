"""Group C, Phase 10 verification: real email through Resend (D-072).

    python scripts/verify_email.py --to you@example.com

Needs RESEND_API_KEY in backend/.env and the stack up. Local dev logs emails by default
(EMAIL_PROVIDER=log); this switches the running backend to `resend` for the run -- backing up
backend/.env, appending EMAIL_PROVIDER=resend, recreating the container -- and restores the
file byte for byte at the end, whatever happens. Without your own verified domain, Resend's
test sender only delivers to the address the Resend account was created with, so --to must be
that address.

What it does, through the real API:
  1. Registers a throwaway account at --to (or, if that address already has a local account,
     uses it), which sends a verification email.
  2. Asks for a password reset for the same address, which sends a reset email.
  3. Checks the backend log: both emails accepted by Resend (each with a Resend id), none
     failed, and neither the key nor a link was logged.
Then you check the inbox: two emails, and their links open the app's verify and reset pages.
After you've clicked the verify link, `--confirm --to ...` checks the account is now verified.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ENV = os.path.join(ROOT, "backend", ".env")
BACKUP = ENV + ".verify-email-backup"

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + str(detail)) if detail else ''}")
    return condition


def call(method, path, payload=None):
    req = urllib.request.Request(f"{BACKEND}{path}", data=json.dumps(payload).encode() if payload is not None else None, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def compose(*args, check_ok=True):
    return subprocess.run(["docker", "compose", *args], cwd=ROOT, capture_output=True, text=True, check=check_ok)


def psql(sql):
    return compose("exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "interviewforge", "-tAc", sql).stdout.strip()


def wait_for_backend():
    for _ in range(60):
        try:
            urllib.request.urlopen(f"{BACKEND}/api/problems/daily", timeout=3)
            return True
        except Exception:
            time.sleep(2)
    return False


def recreate_backend():
    compose("up", "-d", "--force-recreate", "backend")
    return wait_for_backend()


def key_value():
    for line in open(ENV):
        if line.startswith("RESEND_API_KEY="):
            return line.split("=", 1)[1].strip()
    return ""


def confirm(address):
    verified = psql(f"SELECT email_verified FROM users WHERE LOWER(email) = LOWER('{address}')")
    check(f"{address} is now verified (the emailed link worked)", verified == "t", verified)


def send(address):
    key = key_value()
    if not check("RESEND_API_KEY is set in backend/.env", key.startswith("re_")):
        return
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    shutil.copyfile(ENV, BACKUP)
    try:
        with open(ENV, "a") as handle:
            handle.write("\nEMAIL_PROVIDER=resend\n")
        check("backend restarted in resend mode", recreate_backend())
        logs = compose("logs", "--since", started, "backend").stdout
        check("it says so at startup", "[startup] email: resend" in logs)
        for pattern in ["rl:auth-write:*", "rl:api:*"]:
            for k in compose("exec", "-T", "redis", "redis-cli", "--scan", "--pattern", pattern).stdout.split():
                compose("exec", "-T", "redis", "redis-cli", "del", k)

        status, body = call("POST", "/api/auth/register", {
            "username": f"p10{uuid.uuid4().hex[:8]}", "email": address, "password": "Str0ngPassw0rd!",
        })
        if status == 409:
            print(f"  ....  {address} already has a local account; using it for the reset email only")
        else:
            check("registered: the verification email is on its way", status == 201, status if status == 201 else (status, body))
        status, _ = call("POST", "/api/auth/forgot-password", {"email": address})
        check("asked for a password reset", status == 200, status)

        time.sleep(8)  # both sends run in the background
        logs = compose("logs", "--since", started, "backend").stdout
        accepted = re.findall(r"\[email:resend\] Sent \"([^\"]+)\" to (\S+) \(id ([0-9a-f-]+)\)", logs)
        subjects = [a[0] for a in accepted]
        check("Resend accepted the reset email", "Reset your InterviewForge password" in subjects, accepted)
        if status != 409:
            check("Resend accepted the verification email", "Confirm your email for InterviewForge" in subjects, accepted)
        failures = [l for l in logs.splitlines() if "[email]" in l and "failed" in l]
        check("no send failed", not failures, failures[:2])
        check("the key never appears in the log", key not in logs)
        check("no link (a credential) appears in the log", "token=" not in logs)
    finally:
        shutil.copyfile(BACKUP, ENV)
        os.remove(BACKUP)
        recreate_backend()
        restored = "EMAIL_PROVIDER=resend" not in open(ENV).read()
        check("backend/.env restored and the backend back in log mode", restored and "[startup] email: log" in compose("logs", "--since", "60s", "backend").stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--to", required=True, help="the address your Resend account was created with")
    parser.add_argument("--confirm", action="store_true", help="after clicking the emailed verify link: check it worked")
    args = parser.parse_args()
    confirm(args.to) if args.confirm else send(args.to)
    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
