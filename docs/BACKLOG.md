# Backlog

What is deliberately *not* built yet. Condensed from the two phase plans (`EXECUTION_PLAN.md`,
`UI_UX_PLAN.md`) when they were retired on 2026-09-20 — both remain in git history at `4083f5e`.
Everything that shipped, including the end-to-end verification rounds (D-058), is in
[`DECISIONS.md`](DECISIONS.md). When an item here ships, delete it and write the decision entry.

Effort: **S** hours · **M** a day or two · **L** a week+.
**Loud** = an interviewer notices · **Quiet** = nobody praises it, everybody notices its absence.

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
- **Leaderboard caching** *(S–M, Quiet)* — the leaderboard aggregates every submission on each
  request; no index helps (measured in D-053). Cache it, or keep a materialised view refreshed on
  submit. Pairs naturally with the Redis item above.
- **Repository/service layer** *(M, Quiet)* — routes currently hold SQL and business logic.
- **More languages** *(M)* — JS, Go, Rust: a Dockerfile and harness each.
- **Custom test cases + failing-case diff view** *(S)* — the gap between "toy judge" and "tool
  I'd actually use".
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
