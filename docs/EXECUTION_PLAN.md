# Execution Plan

The single source of truth for what gets built and in what order. Phases 0–5 are the
committed scope; everything considered but not scheduled is parked with its rationale at
the bottom, so nothing is lost.

**Status:** Phases 0, 1, 4, 2 and 3 complete. All retrieval work is done: nDCG 0.7712 →
0.9009 across Phases 2 and 3. Awaiting approval for Phase 5 (resume-grounded interviews).

---

## Working agreement

These rules apply to every phase.

### The iteration loop

Each phase runs a **minimum of three iterations**. An iteration is not "some work" —
it has a fixed shape:

| Iteration | Purpose | Done when |
|---|---|---|
| **1 — Build** | Implement the phase's scope end to end | The code exists and compiles/imports |
| **2 — Verify** | Run it for real; find what's broken | Every check defined in *Verification* below has been run, output captured |
| **3 — Refine** | Fix what iteration 2 surfaced; simplify; handle edge cases; update docs | All checks pass, no known defects outstanding |

If iteration 3's verification fails, **iteration 4 happens** (and 5, and so on). Three is
the floor, never the ceiling. A phase does not exit on iteration count — it exits on its
**Exit criteria** being met.

### Verification means running things, not reading them

Every phase declares concrete checks. "It looks right" is not verification. Each
iteration-2 and iteration-3 pass captures actual command output. Where a phase depends on
Docker, that dependency is stated explicitly and the phase cannot be marked complete
without it.

### Pause protocol

After a phase's exit criteria are met:
1. Commit the phase.
2. **Stop.** Report what was built, what the verification showed, and anything surprising.
3. Wait for explicit approval before starting the next phase.

No phase begins on assumption. If something in a phase reveals that a *later* phase's
plan is wrong, that gets raised at the pause, not silently worked around.

### Commits

- One commit per phase, on the working branch.
- Conventional-commit prefixes, matching existing repo history: `feat(scope):`,
  `test:`, `perf(rag):`, `chore:`, `docs:`.
- **Title + body.** Title ≤ 72 chars, imperative mood. Body explains *why*, notes
  verification performed, and references the phase and any decision/finding IDs.
- Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

### Branch

All phases land on **`feat/platform-v2`**, branched from `main`. Merged to `main` only
after the final verification round passes. `main` stays deployable throughout.

### Cost discipline

`ai-service/.env` holds live API keys and the AWS free tier is gone, so LLM calls are
real money now. Every phase that touches an LLM must:
- Cache aggressively (record responses to fixtures; replay in tests).
- Keep the golden evaluation set small and deliberate (~30 queries, not 300).
- Never call a live model from a unit test — only from the explicit `eval` entry point.

---

## Phase 0 — Test & CI foundation

> **Goal:** `npm test` and `pytest` run real tests, and CI runs them on every push.
> Nothing after this phase is verifiable without it.

Closes F-01, F-02.

**Scope**
- Vitest in `backend/` — first real tests: auth token logic, UUID param validation,
  `compareOutputs` from code-runner.
- pytest in `ai-service/` — `conftest.py` with fixtures mocking the LLM and Chroma so no
  test costs money or needs a network.
- `.github/workflows/ci.yml` — matrix over `backend` / `web` / `ai-service`:
  lint → typecheck → test → build.

**Iterations** *(min 3)*
1. **Build** — configure Vitest + pytest, write the first real tests, author `ci.yml`.
2. **Verify** — run every check below, capture output. Deliberately break the code and
   confirm tests fail (a test that can't fail isn't a test).
3. **Refine** — fix what broke, delete trivial/flaky tests, assert nothing touches the
   network or a key, re-run green.

**Verification**
- `cd backend && npm test` → passes, non-zero count.
- `cd backend && npm run build` and `cd web && npm run build` → clean.
- `docker compose exec ai-service pytest` → passes.
- Workflow green on a pushed branch.

**Exit criteria** — both empty test dirs contain passing meaningful tests; CI green; no
test requires an API key or network.

**Commit:** `test: establish test runners and CI pipeline`

---

## Phase 1 — The measurement spine

> **Goal:** retrieval and judge quality become **numbers**. Every later claim is measured
> against the baseline this phase produces.

**Scope**
- Golden query set (~30 queries across company × stage × difficulty) with labelled
  relevant sources.
- RAGAS-style harness: context precision, context recall, faithfulness, answer relevance.
  Entry point `python -m app.eval.run` → timestamped JSON + markdown table.
- **Score monotonicity test** — golden answers at known quality tiers (bad / mediocre /
  strong) per stage; assert the judge ranks them correctly.
- Prompt regression snapshots from recorded LLM responses.
- Baseline committed to `docs/eval/baseline.md`.

**Iterations** *(min 3)*
1. **Build** — golden set, metrics module, `app.eval.run`, monotonicity test, snapshots.
2. **Verify** — run the harness twice and compare for reproducibility; run monotonicity;
   deliberately corrupt a prompt to prove the snapshot test catches it, then revert.
3. **Refine** — fix nondeterminism, set tolerances, commit the baseline, wire monotonicity
   + snapshots into CI.

**Verification** *(needs Docker + live keys)*
- Harness runs end to end and emits a metrics table.
- Monotonicity passes; corrupted prompt fails the snapshot test.
- Two consecutive runs agree within tolerance.

**Exit criteria** — committed baseline with real numbers; monotonicity + snapshots in CI.

> **Baseline scope note:** this baseline is measured against the **current 4 companies**.
> Phase 4 adds companies, which shifts the corpus — so Phase 4 re-baselines. Phases 2 and
> 3 must be measured against *this* baseline, before the corpus changes, or their deltas
> are meaningless.

**Commit:** `test(rag): add evaluation harness and quality baseline`

---

## Phase 2 — Index-side retrieval quality

> **Goal:** improve what goes *into* the vector store. Everything here changes how
> documents are chunked and embedded, so each change requires a full re-index.

Split from query-side work (Phase 3) deliberately: index-side changes are expensive to
apply (re-embed the whole corpus) and query-side changes are cheap (no re-index). Mixing
them makes it impossible to attribute a metric change to the right cause.

**Scope**
1. **Smarter chunking** — replace flat `RecursiveCharacterTextSplitter` with
   markdown/semantic-aware splitting that respects document structure (headings, sections)
   instead of character counts.
2. **Small-to-big retrieval** — embed small chunks for precision, return the enclosing
   parent section for context.
3. **Contextual retrieval** — a cheap LLM writes a one-line situating summary per chunk,
   prepended before embedding.

**Iterations** *(min 4 — one per technique, plus refine)*
1. **Build + measure** semantic chunking. Re-index, re-run harness, record delta.
2. **Build + measure** small-to-big retrieval. Re-index, re-run, record delta.
3. **Build + measure** contextual retrieval. Re-index, re-run, record delta.
4. **Refine** — stack survivors, re-measure combined, revert anything that didn't help.

**Verification**
- Harness re-run after each change; deltas recorded individually.
- Chunk-count and token-cost impact recorded (contextual retrieval costs an LLM call per
  chunk at index time — the cost must be stated, not hidden).
- Full test suite green.

**Exit criteria** — `docs/eval/phase2.md` with per-technique and stacked results.
**If a technique doesn't help it gets reverted and the negative result recorded.**

**Commit:** `perf(rag): semantic chunking, small-to-big and contextual retrieval`

---

## Phase 3 — Query-side retrieval quality

> **Goal:** improve what happens *at question time*. No re-indexing — these are all
> cheap to try and cheap to revert.

**Scope**
1. **Cross-encoder reranking** — retrieve top-20, rerank, keep 5.
2. **Hybrid search + RRF** — dense + BM25 fused by Reciprocal Rank Fusion.
3. **MMR** — diversify so the LLM isn't fed five near-duplicate passages.
4. **Query routing** — per-stage retrieval strategy and `top_k`.

**Iterations** *(min 5 — one per technique, plus refine)*
1. **Build + measure** reranking. 2. **…** hybrid + RRF. 3. **…** MMR. 4. **…** routing.
5. **Refine** — stack survivors, re-measure combined (stacked gain is never the sum of
   individual gains), revert non-helpers, write up.

**Verification**
- Harness re-run after each change; individual deltas recorded.
- **Latency measured per technique** — reranking adds real time per question; the
  precision/latency trade-off must be quantified, not assumed acceptable.
- A/B a handful of generated questions old-vs-new for a qualitative read.

**Exit criteria** — `docs/eval/phase3.md` with per-technique and stacked results, plus a
latency column.

**Commit:** `perf(rag): cross-encoder reranking, hybrid search, MMR and query routing`

---

## Phase 4 — Hybrid live ingestion + company expansion

> **Goal:** the corpus stops being a fixture and becomes self-expanding, driven by what
> users actually ask for — which is also the mechanism for onboarding new companies.

Closes F-08, F-11, F-13.

### How the hybrid works *(option C)*

```
nightly batch:  curated sources → clean → dedupe → chunk → embed → Chroma
                (covers the common cases, fast and cheap)

at question time:
     query → Chroma lookup
           → confidence check: are the top hits actually relevant?
               ├─ YES → generate (≈50ms, the normal path)
               └─ NO  → live web fetch → clean → chunk → embed
                        → WRITE BACK to Chroma → generate (≈5-15s, once)
                          ↳ every later user asking this gets the fast path
```

The write-back is the point: this is a **read-through cache over a vector store**. The
first person to ask about a thinly-covered company pays the latency; everyone after
doesn't. The corpus grows around real demand instead of guesses.

### Why company expansion belongs here

New companies start with no corpus. Rather than hand-writing guides for each, a new
company's first few interviews trigger the low-confidence path and the corpus builds
itself. Batch-seed a thin starter doc per company, let demand fill the rest.

**Scope**
- Confidence scoring on retrieval results (distance thresholds + company/stage coverage).
- Live fetch path: search → fetch → boilerplate stripping → near-dupe detection
  (MinHash/SimHash atop existing SHA-256 IDs) → embed → **write back**.
- Provenance metadata: `source_url`, `title`, `ingested_at`, `license`, `origin`
  (batch vs live).
- Freshness-weighted ranking.
- Nightly batch job for the curated core.
- **Citations surfaced in the web UI.**
- **Expand to ~10 companies** (currently 4). Priority by existing problem tags:
  **Microsoft** (38 tagged problems, no profile), then Bloomberg, Uber, Adobe, LinkedIn,
  Airbnb. Each needs a `company_profiles.py` entry (style, focus areas, stage topics,
  difficulty calibration) plus a thin starter doc.
- **Fix the Facebook/Meta duplicate tag** (F-11).
- Guardrails: per-request fetch timeout, live-fetch rate cap, domain allowlist, and a
  hard cap on live fetches per user per day so this cannot run away with the API budget.

**Iterations** *(min 4)*
1. **Build** — confidence scoring, live fetch + write-back, provenance, batch job.
2. **Build** — company profiles + starter docs for the 6 new companies; fix F-11.
3. **Verify** — run ingestion twice, assert stable count (idempotency); force a
   low-confidence query and confirm fallback fires, writes back, and the *second*
   identical query takes the fast path; re-baseline the eval harness on the expanded
   corpus; click through UI citations.
4. **Refine** — tune the confidence threshold (too eager burns money, too lazy defeats the
   purpose), fix dupes and junk from noisy sources, re-verify.

**Verification**
- Idempotency: ingest twice → stable document count.
- Fallback fires on low confidence, and **does not** fire on high confidence
  (both directions tested — a fallback that always fires is just option B).
- Write-back works: same query twice → second is fast-path.
- Daily cap enforced.
- Re-baseline recorded; quality not regressed by noisier corpus.
- Citations render and link correctly.

**Exit criteria** — hybrid path verified in both directions, 10 companies live, new
baseline recorded, spend guardrails enforced.

**Commit:** `feat(rag): hybrid live ingestion with write-back and 10 company profiles`

---

## Phase 5 — Resume-grounded interviews

> **Goal:** one flagship differentiator with no obvious peer in a portfolio project.

Chosen over Elo adaptive difficulty and empirical complexity detection because it reuses
the RAG infrastructure Phases 2–4 will have hardened, and forces genuine multi-tenancy in
the vector store. *(Swap at the Phase 4 pause if preferred — both alternatives are parked
below with rationale.)*

**Scope**
- Resume upload + parse (PDF → text → structured sections).
- Per-user Chroma namespace: isolation, scoped retrieval, deletion on request.
- Question generation grounded in the candidate's *actual* projects.
- Retrieval blending personal context with company context.

**Iterations** *(min 3)*
1. **Build** — upload + parse, namespaces, blended retrieval, grounded generation.
2. **Verify** — isolation and deletion tests; full upload → interview → questions path.
3. **Refine** — close any cross-user leakage (the phase's whole risk), handle malformed
   and scanned PDFs, re-run isolation from scratch.

**Verification**
- Two users' resumes; **neither can retrieve the other's chunks.** This is a data-leak
  class of bug — non-negotiable.
- Deletion purges vectors, verified by direct query.
- End to end: questions demonstrably reference real resume content.

**Exit criteria** — isolation and deletion pass; demo path works start to finish.

**Commit:** `feat(interview): resume-grounded personalized interviews`

---

## Phase 6 — Hardening & credibility

> **Goal:** close the security and observability gaps that are currently documented
> weaknesses, turning them into strengths.

Closes F-03, F-04, F-05.

**Scope**
- **Sandbox hardening**: drop `User: "root"`, add `CapDrop: ["ALL"]`,
  `SecurityOpt: ["no-new-privileges"]`, `ReadonlyRootfs` + tmpfs, `PidsLimit`, `NanoCpus`.
- Real memory measurement from cgroup stats.
- Per-user LLM rate limits replacing the global 500/15min bucket.
- Correlation IDs threaded browser → Express → FastAPI → code-runner.
- LLM cost/latency observability: tokens and cost per session.

**Iterations** *(min 3)*
1. **Build** — apply flags, cgroup memory, per-user limits, correlation IDs, cost tracking.
2. **Verify** — adversarial suite *and* the full problem suite across all four languages.
   Hardening that breaks legitimate execution is the real risk, so both halves run.
3. **Refine** — adjust any flag that broke valid programs (a read-only rootfs without the
   right tmpfs mounts breaks compilation), then re-run **both** suites.

**Verification** *(requires Docker)*
- Fork bomb → contained by `PidsLimit`. Write outside tmpfs → denied. Network → refused.
  Privilege escalation → blocked.
- All four sandboxes still pass the existing problem suite.
- User A exhausting quota does not affect user B.
- One request traced across four services by a single correlation ID.

**Exit criteria** — every adversarial test contained; no regression in normal execution.

**Commit:** `feat(security): harden sandboxes, add per-user limits and tracing`

---

## Phase 7 — Content depth

> **Goal:** enough problems, properly verified, that the practice side stands on its own
> rather than reading as a demo.

Independent of everything above — touches no RAG code. **Can be pulled forward** to any
point after Phase 0 if visible progress matters more than sequencing.

Closes F-12.

**Scope**
- **Expand the problem set** from 42 to ~150, keeping the difficulty spread balanced
  (currently 12 easy / 18 medium / 12 hard). Each needs description, test cases, starter
  code across 4 languages, hints, editorial, topic and company tags.
- **Company-filtered practice** — "practice Amazon problems." The `companies[]` column is
  already populated on all 42 problems, so this is mostly UI plus a query filter.

**Iterations** *(min 3)*
1. **Build** — problem seed expansion, company filter endpoint + UI.
2. **Verify** — every new problem's test cases actually pass against a known-good solution
   in **all four languages** (this is the real work — a problem with a broken harness is
   worse than no problem); company filter returns correct sets.
3. **Refine** — fix broken harnesses and wrong expected outputs, rebalance difficulty
   spread, re-verify.

**Verification**
- Every seeded problem passes a reference solution in python, c, cpp, java.
- Company filter returns correct sets for each of the 13 tags.
- Existing streak and analytics queries unaffected by the larger problem set.

**Exit criteria** — ~150 problems all verified executable; company filter works.

**Commit:** `feat(problems): expand problem set and add company-filtered practice`

---

## Final verification — 2 full rounds

Run after all phases complete. Each round covers the **entire system**, not just the last
phase. Each round is itself a full **Verify → Refine** pass: if a round surfaces a defect,
it is fixed and **that entire round is re-run from the top**, not resumed from the failure.

**Round 1 — Correctness**
- Full stack from scratch: `docker compose up --build` on clean volumes.
- All migrations apply in order against an empty database; all seed scripts run.
- Full test suite green across all three services.
- Manual walkthrough of every primary flow: register → login → solve a problem (all 4
  languages) → full 4-stage interview → report + PDF → assessment → learning path →
  analytics → leaderboard.
- Eval harness re-run; numbers match Phase 4's recorded re-baseline.

**Round 2 — Resilience & docs**
- Adversarial sandbox suite re-run.
- Failure modes: LLM provider rate-limited (fallback engages), Chroma unreachable,
  code-runner down, **live-fetch source unreachable or slow** (must degrade to whatever
  local context exists, never hang the interview), malformed input to every endpoint.
- Cross-user isolation re-verified.
- Live-fetch spend caps re-verified.
- **Docs audit**: README, CLAUDE.md, DECISIONS.md, EXECUTION_PLAN.md all match reality.
  Every command in the README executed verbatim on a clean checkout.
- Every finding closed is marked closed.

**Exit:** merge `feat/platform-v2` → `main`.

**Commit:** `chore: final verification across all phases`

---

## Deliberately not in this plan

Parked with rationale so nothing is lost. Roughly priority-ordered. Effort: S (hours),
M (a day or two), L (a week+). **Loud** = an interviewer notices; **Quiet** = nobody
praises it, everybody notices its absence.

### Interviewer intelligence
- **Agentic interviewer** *(L, Loud)* — replace the fixed
  `behavioral → coding → system_design → core_cs` state machine (max one follow-up per
  stage) with a tool-using agent that decides to probe deeper, pivot, or move on. The RAG
  half of this project is sophisticated; the orchestration half is an if/else chain in
  `interviews.routes.ts`, and that gap is what a thorough interviewer will find.
- **Grounded challenge** *(M, Loud)* — push back when a candidate asserts something the
  retrieved context contradicts. The most "that felt real" moment available, and it reuses
  retrieval that already exists.
- **Hint-ladder policy** *(M, Loud)* — track time-stuck and answer quality, decide whether
  to nudge, apply a scoring penalty per hint. Mirrors how real interviews actually score.
- **Interviewer personas** *(S)* — friendly / terse / adversarial as a prompt dimension.
- **SSE streaming** *(M, Loud)* — token-by-token generation through FastAPI → Express →
  browser. Real UX win, and a genuine conversation about backpressure across two hops.

### Retrieval extras
- **Semantic caching** *(M)* — serve cached context when a query is within a similarity
  threshold of a recent one. Cuts spend and yields a cache-hit-rate number to quote.
  *(Partially superseded by Phase 4's write-back cache.)*

### Alternative showpieces *(Phase 4 candidates not chosen)*
- **Elo-rated adaptive difficulty** *(L, Loud)* — per-topic Elo for users *and* problems,
  updated after each attempt, selecting the next problem at ~60–70% success probability.
  Real algorithm, real math; arguably the most *interview-able* single feature available.
- **Empirical complexity detection** *(L, Loud)* — run a passing solution against
  geometrically increasing inputs, curve-fit measured runtimes against O(n) / O(n log n) /
  O(n²), then compare to what the LLM code reviewer *claimed*. Nobody builds this. Honest
  empiricism rather than another model opinion.

### Engineering credibility
- **OpenAPI contract + generated client** *(M, Quiet)* — FastAPI emits a spec free; add one
  for Express and generate the TS client for `web/`, which currently hand-mirrors backend
  types so drift is silent. (F-09, narrowed by D-007)
- **Redis + BullMQ worker pool** *(L, Loud)* — bounded concurrency in front of code-runner,
  distributed rate limiting, and leaderboard caching. Three wins from one component.
- **Query audit** *(M, Quiet)* — `EXPLAIN ANALYZE` the leaderboard and analytics queries,
  add missing indexes, fix N+1s. Yields specific, convincing numbers.
- **Repository/service layer** *(M, Quiet)* — routes currently hold SQL and business logic.
- **More languages** *(M)* — JS, Go, Rust. Mechanical: a Dockerfile and harness each.
- **Custom test cases + failing-case diff view** *(S)* — the gap between "toy judge" and
  "tool I'd actually use."
- **Real email delivery** *(S)* — SES or Resend for verification and reset. (F-07)

### Product
- **Problem of the Day** *(S)* — deterministic daily selection seeded by date so every user
  gets the same problem, plus POTD history and a "solved today" badge. Would tie into the
  existing streak logic, which already computes from submission dates at query time.
  *Removed from Phase 7 by choice — revisit once the problem set is large enough for a
  daily rotation to be worth having.*
- **Session replay + shareable public report links** *(M, Loud)* — a permanent URL for the
  resume: a recruiter clicks and sees a real transcript with scores, no signup.
- **Spaced repetition** *(M)* — SM-2 over failed/hinted problems as a daily review queue.
- **Weakness → auto-generated learning path** *(M)*.
- **Peer mock interviews** *(L)* — WebRTC over the dormant Socket.IO. (F-06)
- **Assessment proctoring** *(S)* — tab-switch and paste detection.

### Presentation
- **Demo video + README GIFs** *(S, Loud)* — **worth pulling forward early if the goal is
  resume impact rather than engineering depth.** It's the substitute for the live link that
  no longer exists (D-004), and it's more reliable than one: no quota to exhaust, no broken
  link for a recruiter to click.

---

## Progress

| Phase | Status | Iterations | Commit |
|---|---|---|---|
| 0 — Test & CI foundation | ✅ Complete | 3 | `3068f5f` |
| 1 — Measurement spine | ✅ Complete | 3 | `b957e02` |
| 4 — Hybrid ingestion + companies | ✅ Complete | 4 | `cecc975` |
| 3 — Query-side retrieval | ✅ Complete | 5 | `53204fe` |
| 2 — Index-side retrieval | ✅ Complete | 4 | `6358706` |
| 5 — Resume-grounded interviews | ⬜ Next | — | — |
| 6 — Hardening & credibility | ⬜ Not started | — | — |
| 7 — Content depth | ⬜ Not started | — | — |
| Final verification R1 | ⬜ Not started | — | — |
| Final verification R2 | ⬜ Not started | — | — |

## Minimum great outcome

Eight phases is a lot, and stopping early is always allowed — that's what the pauses are
for. If time or budget runs short:

**Phases 0–4 alone** make this a substantially stronger project than it is today: real
tests and CI, measured RAG quality with before/after numbers, a self-expanding corpus, and
10 companies. That is the complete "I engineer RAG systems" story.

Phases 5–7 are additive: 5 is the flagship demo feature, 6 turns documented weaknesses
into strengths, 7 is product polish. Valuable, but none of them is load-bearing for the
core narrative.
