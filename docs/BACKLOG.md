# Backlog & remaining verification

What is deliberately *not* built yet, and the verification that has not been run.
Condensed from the two phase plans (`EXECUTION_PLAN.md`, `UI_UX_PLAN.md`) when they were
retired on 2026-09-20 — both remain in git history at `4083f5e` if the full phase
breakdowns, exit criteria or iteration logs are ever needed. What actually shipped is in
[`DECISIONS.md`](DECISIONS.md); this file is only the forward-looking remainder.

Effort: **S** hours · **M** a day or two · **L** a week+.
**Loud** = an interviewer notices · **Quiet** = nobody praises it, everybody notices its absence.

## End-to-end verification — DONE (2026-09-21)

Both rounds were run end to end for the first time, both green.

**Round 1 — correctness. ✅** Full stack from clean volumes; all 11 migrations applied in order
against an empty database; every seed script run; **581/581 tests** across all services (backend 73,
code-runner 48, ai-service 405, web 55); lint + backend `tsc` + web `next build`; an 18-step
walkthrough of register → solve in all 4 languages → 4-stage interview → report → assessment →
learning path → analytics → leaderboard; eval harness re-run and reproducing the recorded numbers
(nDCG 0.899, MRR 0.917, hit_rate 0.952).

**Round 2 — resilience. ✅** Cross-user resume isolation re-verified (29/29, incl. deletion purge and
all malformed-PDF classes); malformed input to endpoints returns correct 400/404/401; failure modes
injected — **Chroma-down and code-runner-down both degrade to a retryable 503**, services stay
healthy; adversarial sandbox holds at runtime (infinite loop → Time Limit Exceeded, zero leaked
containers); `verify_phase7.py` 46/46; closed findings F-12/F-14/F-21/F-22 reconfirmed.

**Two findings surfaced:** (1) the recorded eval numbers are only reproducible with
`app.ingest.reindex --rebuild` from `ai-service/.corpus_cache`, which is **not git-tracked** — so a
clean clone cannot reproduce them without live re-fetch (decided: not fixed, low priority). (2)
code-runner-unreachable returned a generic 500 instead of a retryable 503 — **fixed and merged**
(PR #8). Not exercised: live-fetch spend caps (F-19, needs Gemini grounding quota that 429s on free
tier, F-20) and the 600-run `verify_problems.py` (already verified once under Phase 7).

## Presentation

- ~~**Demo video + README GIFs** *(S, Loud)*~~ — **DONE (2026-09-21).** Two README GIFs (coding
  workspace + resume-grounded interview) captured against the live stack via Playwright and embedded
  at the top of the README (`docs/assets/`). A produced video was deliberately skipped in favour of
  the GIFs — the substitute for the live link that no longer exists (D-004), with no quota to exhaust
  or dead link to rot.

## Interviewer intelligence

- **Agentic interviewer** *(L, Loud)* — replace the fixed
  `behavioral → coding → system_design → core_cs` state machine (max one follow-up per stage)
  with a tool-using agent that probes, pivots or moves on. The RAG half of this project is
  sophisticated; the orchestration half is an if/else chain in `interviews.routes.ts`, and
  that gap is what a thorough interviewer will find.
- **Grounded challenge** *(M, Loud)* — push back when a candidate asserts something the
  retrieved context contradicts. The most "that felt real" moment available, and it reuses
  retrieval that already exists.
- **Hint-ladder policy** *(M, Loud)* — track time-stuck and answer quality, decide whether to
  nudge, apply a scoring penalty per hint.
- **SSE streaming** *(M, Loud)* — token-by-token through FastAPI → Express → browser. Real UX
  win and a genuine backpressure conversation across two hops.
- **Interviewer personas** *(S)* — friendly / terse / adversarial as a prompt dimension.

## Alternative showpieces (considered and not chosen)

- **Elo-rated adaptive difficulty** *(L, Loud)* — per-topic Elo for users *and* problems,
  selecting the next problem at ~60–70% success probability.
- **Empirical complexity detection** *(L, Loud)* — run a passing solution against
  geometrically increasing inputs, curve-fit against O(n) / O(n log n) / O(n²), then compare
  with what the LLM reviewer *claimed*. Honest empiricism rather than another model opinion.

## Engineering credibility

- **OpenAPI contract + generated client** *(M, Quiet)* — FastAPI emits a spec free; add one
  for Express and generate the TS client, which `web/` currently hand-mirrors so drift is
  silent (F-09).
- **Redis + BullMQ worker pool** *(L, Loud)* — bounded concurrency in front of code-runner,
  distributed rate limiting, leaderboard caching. Three wins from one component, and it fixes
  the in-process limiter counters (F-19).
- ~~**Fix F-23**~~ — **DONE (D-053)**, together with auth limiters, a fail-closed JWT secret, helmet
  and `TRUST_PROXY`.
- **Query audit** *(M, Quiet)* — `EXPLAIN ANALYZE` the leaderboard and analytics queries, add
  missing indexes, fix N+1s.
  *Indexes done in D-053 (migration 012). Remaining: the leaderboard is a full aggregate that no
  index helps; it needs caching or a materialised view.*
- **Repository/service layer** *(M, Quiet)* — routes currently hold SQL and business logic.
- **More languages** *(M)* — JS, Go, Rust: a Dockerfile and harness each.
- **Custom test cases + failing-case diff view** *(S)* — the gap between "toy judge" and "tool
  I'd actually use".
- ~~**Token revocation**~~ — **DONE (D-055)**: `token_version`, sign out everywhere, and the web
  client returns to login when a session ends.
- **Route-level backend tests** *(M, Quiet)* — `interviews.routes.ts` (631 lines), submissions,
  problems, users and assessments have no route tests; the 400/404/503 contract is checked only by
  the live verify scripts.
- ~~**CI builds the prod images**~~ — **DONE (D-054)**: all four prod images plus the four sandboxes
  build in CI, and a smoke test checks image contents and boot.
- **Real email delivery** *(S)* — SES or Resend for verification and reset (F-07).

## Product

- **Problem of the Day** *(S)* — deterministic date-seeded selection, POTD history, "solved
  today" badge; ties into streaks, which already compute at query time.
- **Session replay + shareable public report links** *(M, Loud)* — a permanent URL a recruiter
  can open without signing up.
- **Spaced repetition** *(M)* — SM-2 over failed/hinted problems as a daily review queue.
- **Weakness → auto-generated learning path** *(M)*.
- **Peer mock interviews** *(L)* — WebRTC over the dormant Socket.IO (F-06).
- **Assessment proctoring** *(S)* — tab-switch and paste detection.
- **Semantic caching** *(M)* — serve cached context within a similarity threshold of a recent
  query. Partially superseded by the Phase 4 write-back cache.

## Carried over from the UI workstream

- **Local production homepage warm load rose 24.2 ms → 35.1 ms and decoded script bytes grew
  14.7%** across the UI phases (D-052). Directional local measurements, not field Web Vitals —
  worth a profiling pass before they become real.
- **Screen-reader and real-device microphone testing** were outside the automated pass;
  narrow-width checks cover the responsive site, not a native client.
