# Decisions & Findings

A running log. Newest first. Append entries as work happens — don't rewrite old ones;
if a decision is reversed, add a new entry that supersedes it and link back.

Entry format: date, what was decided, why, and what it means going forward.

---

## 2026-09-04

### D-012 — Benchmark is saturated; Phase 4 must move before Phases 2 and 3
**Finding:** the Phase 1 baseline scores hit_rate 1.000, MRR 1.000, nDCG 0.987 and
normalised precision 0.983 — with *and* without the metadata filter. Retrieval sits at
~98% of the achievable ceiling.
**Why:** 34 documents across 16 well-separated company × stage topics means nearly every
query has one obviously-correct document and no competitors. Dense embeddings win
trivially. The benchmark measures the corpus, not the retriever.
**Consequence:** Phases 2 (index-side) and 3 (query-side) **cannot show measurable
improvement** here. ~1.3% nDCG headroom is below the noise floor. Reranking, hybrid
search and semantic chunking all target failure modes this corpus does not exhibit.
**Decided:** reorder — run **Phase 4 (corpus expansion + hybrid ingestion) before
Phases 2 and 3**, then re-baseline on the larger corpus and only then measure retrieval
techniques. This reverses the sequencing constraint in D-009, which assumed the corpus was
adequate and only worried about company changes shifting the baseline. The deeper problem
is that a 34-document corpus cannot support retrieval benchmarking at all.
**Kept:** the index-side/query-side split from D-009 still holds; only the order relative
to Phase 4 changes.

### D-013 — Embedding provider switched to Gemini; OpenAI model config was stale
**Finding:** `text-embedding-004` (the configured Gemini default) returns 404 — retired.
The OpenAI key in `ai-service/.env` was also returning 401 at the time.
**Decided:** default `EMBEDDING_PROVIDER` is now `gemini` and `GEMINI_EMBEDDING_MODEL` is
`gemini-embedding-001` (3072-dim, verified working). The Chroma collection was dropped and
rebuilt, because changing embedding model changes vector dimensionality and a collection
cannot hold both.
**Note:** the OpenAI key was later replaced and now works for both embeddings and chat, so
provider fallback is functional again. Embeddings stay on Gemini — flipping back would
require another full re-index for no measured benefit.
**Operational gotcha recorded:** `docker compose restart` does **not** reload `env_file`;
only `up -d --force-recreate` does. Cost ~20 minutes of false diagnosis.

### D-014 — Judge calibration is asserted as ordering, not absolute scores
**Decided:** the monotonicity check asserts weak < mediocre < strong for the same question,
plus a minimum weak-to-strong spread of 3 points. It does not assert that a strong answer
scores 8.
**Why:** absolute scores drift with prompt and model changes and would make the test
brittle for no benefit. The ordinal claim is the one that must hold — if it breaks, the
scoring is not measuring quality.
**Found a real fixture bug on the first run:** the judge scored the "weak" and "mediocre"
Amazon behavioural answers identically (3 and 3). On inspection the judge was right and the
fixture was wrong — the mediocre answer had the candidate handing the problem to the owning
team, which fails the *ownership* competency being tested, so it was not mid-tier at all.
Rewritten; now 3 / 6 / 9.
**CI:** live runs record responses to `app/eval/fixtures/monotonicity.json`; CI replays them,
so the ordering assertion runs on every push with no API spend.

## 2026-09-03

### D-011 — Phase 0 complete: 143 tests across three services
**Decided:** Vitest for `backend/` and `code-runner/`, pytest for `ai-service/`, and a
GitHub Actions matrix running lint → test → build on every push.
**Why these targets:** the first tests went to pure-logic, high-consequence code —
`compareOutputs` (decides whether every submission passes), the interview stage machine,
UUID validation (the input-validation boundary), and password/JWT handling. No route
handler tests yet: those need a database and belong with the repository layer refactor.
**Verified by mutation, not by passing:** each suite was proven to *fail* when the code
under it was deliberately broken — float tolerance 1e-4 → 1e-12 caught by code-runner,
the one-follow-up-per-stage rule caught by backend, and the RAG unfiltered-retry fallback
caught by ai-service. A test that cannot fail is not a test.
**Two real defects found and fixed:** test files were compiling into `backend/dist` and
`code-runner/dist`, which would have shipped test code (and a `vitest` import) into
production builds. `tsconfig.json` now excludes them.
**Kept prod lean:** pytest went into a new `requirements-dev.txt` used only by the dev
Dockerfile; `Dockerfile.prod` still installs `requirements.txt` alone.
**Honest gap:** `web/` lint is `continue-on-error` because of 4 pre-existing react-hooks
errors (F-14). Refactoring working UI did not belong in the commit that establishes CI,
but the failures are visible in CI output rather than suppressed.


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
| F-16 | `EmbeddingService` has no fallback on *error*: if the configured provider returns 401/404 the call raises rather than trying the other provider, unlike `invoke_with_fallback` for LLM calls | `ai-service/app/rag/embeddings.py` |
| F-17 | Retrieval metrics are identical with and without the company/stage metadata filter, so the filter currently buys nothing measurable on this corpus. Re-test after Phase 4 expands it | `ai-service/app/interview/orchestrator.py` |
| F-14 | 4 pre-existing `react-hooks` lint errors in `web/`: `setState` called synchronously in effects (theme-provider, paths/[slug], problems/[id]) and `Date.now()` called during render (dashboard "days ago" label). CI lint for `web` is `continue-on-error` until fixed | `web/src/` |
| F-15 | `UUID_REGEX` is defined independently in at least 3 route files instead of being imported from `interview-state.service.ts`, which already exports it | `backend/src/routes/` |
| F-11 | `problems.companies[]` contains both `Facebook` (3) and `Meta` (12) as separate tags for the same company | `backend/leetcode_problems.json` |
| F-12 | Only 42 problems seeded (12 easy / 18 medium / 12 hard) — thin for a practice platform | `backend/leetcode_problems.json` |
| F-13 | Problems are tagged with 13 companies but only 4 have interview profiles; Microsoft has 38 tagged problems and no profile | `ai-service/app/interview/company_profiles.py` |
| F-10 | `notes.txt` held the live RDS master password and EC2 IP in plaintext. Correctly gitignored, never committed, and since deleted along with the AWS account — no exposure, recorded for completeness | *(removed)* |
