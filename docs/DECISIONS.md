# Decisions & Findings

A running log. Newest first. Append entries as work happens — don't rewrite old ones;
if a decision is reversed, add a new entry that supersedes it and link back.

Entry format: date, what was decided, why, and what it means going forward.

---

## 2026-09-03

### D-010 — Problem of the Day deferred
**Decided:** POTD removed from Phase 7. Phase 7 is now problem-set expansion (42 → ~150)
plus company-filtered practice only.
**Why:** A daily rotation isn't worth much over 42 problems, and the expansion is the
prerequisite anyway. Parked in the plan's backlog rather than dropped — it's cheap (S) and
the streak logic it would hook into already exists.

### D-009 — Phase 3 scoped as hybrid retrieval (option C), companies merged in
**Decided:** Live corpus work uses **batch + confidence-triggered live fallback with
write-back to Chroma** — a read-through cache over the vector store. Not pure batch, not
pure per-query web search. Company expansion (4 → ~10) merges into the same phase.
**Why:** Pure batch is fast and cheap but only covers what we guessed users would ask.
Pure live search is 5–15s per question, costs money on every request, and returns
uncurated junk. The hybrid pays the latency once per genuine gap and serves everyone after
from the vector store, so the corpus grows around real demand.
**Why companies merge in:** new companies start with no corpus. Rather than hand-writing
guides for each, their first interviews trigger the low-confidence path and the corpus
builds itself. The fallback *is* the onboarding mechanism.
**Guardrails required:** fetch timeout, domain allowlist, per-user daily live-fetch cap.
Without these the fallback can run away with the API budget.
**Also decided:** retrieval work split into index-side (Phase 2: chunking, small-to-big,
contextual retrieval — each requires a full re-embed) and query-side (Phase 3: reranking,
hybrid+RRF, MMR, routing — cheap to try and revert). Mixing them makes it impossible to
attribute a metric change to its cause.
**Sequencing constraint:** Phase 1's baseline is measured on the current 4 companies.
Phases 2 and 3 must be measured against it *before* Phase 4 changes the corpus, or their
deltas are meaningless. Phase 4 re-baselines.

### D-008 — Phased execution with mandatory iteration loops and pauses
**Decided:** Work proceeds via `docs/EXECUTION_PLAN.md`: six phases, each with a stated
goal and exit criteria, a **minimum of three iterations** (build → verify → refine), a
**commit at the end of each phase**, and a **hard pause for approval** before the next
phase starts. Two full-system verification rounds follow all phases.
**Why:** The failure mode for a plan this size is drifting into half-finished work across
many fronts. Exit criteria (not iteration counts) gate each phase, so "done" is defined
before work starts. The pauses keep scope decisions with the user rather than accruing
silently.
**Conventions adopted:** conventional-commit prefixes matching existing history; every
commit has a title *and* a body explaining why and what was verified; commits are
co-authored by Claude; all work lands on `feat/platform-v2` and merges to `main` only
after final verification.
**Constraint recorded:** `ai-service/.env` holds live API keys and there is no free AWS
tier anymore, so LLM calls cost real money. Unit tests must never call a live model —
only the explicit eval entry point does, against a deliberately small golden set.
**Environment note:** the Docker daemon is not currently running, and system Python is
3.9.6 without langchain/chromadb. Phases 1, 3, and 5 cannot be verified without Docker
started; ai-service tests run in-container, not against system Python.

### D-007 — iOS app removed (supersedes D-003)
**Decided:** `ios/` deleted from the working tree; all iOS references stripped from
`README.md` and `CLAUDE.md`. The web app is now the only client.
**Why:** D-003 argued for keeping it on the grounds that an extra client costs nothing.
That reasoning was incomplete. The app has no realistic audience — nobody is going to
install a simulator build to evaluate this project — and maintaining it means reopening
Xcode to verify it still compiles against current toolchains. An unverifiable component
is worse than an absent one: the moment an interviewer asks "can I see it?", a build
failure is a much bigger negative than never having claimed it.
**Not destroyed:** the full app is preserved in git history at commits `e24baf6` and
`b19f09d`. Restoring is `git checkout b19f09d -- ios`.
**Side effect worth noting:** F-09 (web and iOS hand-mirroring backend types with no
shared contract) is now moot as a bug source, but the OpenAPI contract item stays on the
roadmap on its own merits — a generated TS client for `web/` still kills drift between
Express, FastAPI, and the frontend.

### D-006 — Documentation consolidated under `docs/`
**Decided:** All documentation moves to `docs/`, except `README.md` and `CLAUDE.md`,
which stay at the repo root.
**Why:** Root was accumulating loose markdown. But `README.md` is the only file GitHub
renders on the repo landing page, and Claude Code auto-discovers `CLAUDE.md` at the
root specifically — inside `docs/` it would silently never load. Those two are
load-bearing where they are.
**Going forward:** New docs go in `docs/` and get an index row in `docs/README.md`.

### D-005 — Started this decisions log
**Decided:** Track findings and decisions in `docs/DECISIONS.md`, append-only.
**Why:** The reasoning behind choices in this project (keep iOS, don't redeploy, Node
holds no AI logic) currently lives only in conversation and in someone's head. Written
down, it survives, and it's directly reusable when explaining the project in an
interview — "here's my decision log" is a strong signal on its own.

### D-004 — No redeployment; AWS section stays in past tense
**Decided:** Do not redeploy. `README.md` keeps the full AWS Deployment section but
states the environment **was** deployed and has since been torn down.
**Why:** The AWS free tier expired and the account was deleted. The work was real and
the infrastructure experience (EC2 + RDS in a private subnet, Nginx, multi-stage prod
builds, memory tuning for a 1 GB box) is worth documenting accurately. Deleting the
section would erase genuine experience; claiming a live instance would be false.
**Also considered:** Oracle Cloud Always Free (4 ARM vCPU / 24 GB, no expiry) was the
best free redeployment target; Railway/Render/Fly.io were ruled out because they don't
expose a Docker socket, which `code-runner` requires for sandboxed execution.
**Going forward:** A recorded demo video + README GIFs are the substitute for a live
link — no API quota to exhaust, no broken link for a recruiter to click.

### D-003 — Keep the iOS app, but demote it in the README ⚠️ *superseded by D-007*
**Decided:** `ios/` stays. Its README billing shrinks — out of the headline, one
compressed section instead of co-equal weight with the core.
**Why:** Deleting has no upside; nobody penalizes an extra client, and "one backend,
two native clients with feature parity" is uncommon. But the project's story is
RAG + microservices + sandboxed execution, and iOS is orthogonal to all three — every
line of README space it takes is space not spent on what actually differentiates the
project.
**Revisit if:** the Xcode project stops building. An app that doesn't compile is a
liability, not a bonus.
**Outcome:** reversed the same day — see D-007. The "revisit if" clause turned out to be
the whole argument: not wanting to re-verify the build *is* the liability condition.

### D-002 — `.cursorrules` replaced by `CLAUDE.md`
**Decided:** Deleted `.cursorrules`; wrote `CLAUDE.md` at the repo root.
**Why:** Tooling changed. The old file also mixed aspirational product spec with actual
conventions; `CLAUDE.md` carries only what's true of the code today, plus an explicit
*Known gaps* section so those aren't rediscovered every session.

### D-001 — Architecture invariant: Node orchestrates, Python does AI
**Decided (pre-existing, recorded here):** The Express backend contains zero ML/LLM
logic. Anything generated, evaluated, transcribed, or embedded goes over REST to the
FastAPI `ai-service`.
**Why:** Keeps each service small and independently deployable, and lets each side use
its natural ecosystem (LangChain + Chroma in Python, Express + pg in Node).
**Going forward:** This is the rule the whole repo is organized around. Adding an LLM
call to `backend/` is a violation, not a shortcut.

---

## Open findings (not yet decisions)

Things observed in the code that need a call made on them.

| # | Finding | Where |
|---|---|---|
| F-01 | `backend/src/__tests__/` and `ai-service/tests/` exist but are **empty**; no test runner configured in either service | both |
| F-02 | No CI of any kind — no `.github/` directory | repo root |
| F-03 | Sandbox containers run as `User: "root"` despite the images defining a `runner` user; no `CapDrop`, `no-new-privileges`, `ReadonlyRootfs`, `PidsLimit`, or CPU quota | `code-runner/src/runner.ts:82` |
| F-04 | Rate limiting is one global 500 req/15min bucket — a single user can exhaust the whole LLM API quota | `backend/src/index.ts` |
| F-05 | `memoryKb` on submissions is never measured, always null | `code-runner/src/runner.ts` |
| F-06 | Socket.IO is wired on both ends but only emits a `hello` — realtime is unused scaffolding | `backend/src/index.ts`, `web/src/lib/socket.ts` |
| F-07 | Email verification and password reset generate valid tokens, but emails are only `console.log`ed — no SMTP | `backend/src/routes/auth.routes.ts` |
| F-08 | RAG corpus is 34 hand-written documents — the weakest point in the project's strongest story | `ai-service/seed_data/documents.json` |
| F-09 | ~~Web and iOS hand-mirror backend types~~ — narrowed by D-007 (iOS removed). Still no generated contract between Express/FastAPI and `web/` | `web/src/lib/api.ts` |
| F-11 | `problems.companies[]` contains both `Facebook` (3) and `Meta` (12) as separate tags for the same company | `backend/leetcode_problems.json` |
| F-12 | Only 42 problems seeded (12 easy / 18 medium / 12 hard) — thin for a practice platform | `backend/leetcode_problems.json` |
| F-13 | Problems are tagged with 13 companies but only 4 have interview profiles; Microsoft has 38 tagged problems and no profile | `ai-service/app/interview/company_profiles.py` |
| F-10 | `notes.txt` held the live RDS master password and EC2 IP in plaintext. Correctly gitignored, never committed, and since deleted along with the AWS account — no exposure, recorded for completeness | *(removed)* |
