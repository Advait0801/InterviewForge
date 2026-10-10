# Backlog

What is deliberately *not* built yet. Condensed from the two phase plans (`EXECUTION_PLAN.md`,
`UI_UX_PLAN.md`) when they were retired on 2026-09-20 — both remain in git history at `4083f5e`.
Everything that shipped, including the end-to-end verification rounds (D-058), is in
[`DECISIONS.md`](DECISIONS.md). When an item here ships, delete it and write the decision entry.

Effort: **S** hours · **M** a day or two · **L** a week+.
**Loud** = an interviewer notices · **Quiet** = nobody praises it, everybody notices its absence.

## Interviewer intelligence

- **Interview-wide question budget for the agent** *(S)* — the agentic interviewer (D-067) fills
  the third question in nearly every stage. Give it a budget for the whole interview (say 10
  questions across 4 stages) so it must spend extra questions where it learns most; expect lower
  cost and clearer adaptivity. Measure with `app.eval.simulate_interviews`.
- **Thin-company retrieval** *(S)* — Uber and Microsoft contexts return other companies' documents,
  and contexts often contain the same chunk twice (found in D-066). Dedupe chunks by id and widen
  the live-fetch trigger for companies with thin coverage.

## Found while verifying UI B (D-068)

- **All 10 companies on the interview page** *(S, web)* — the backend supports 10; the page offers
  Amazon, Google, Meta and Apple only (true on `main` before UI B too).
- **Reopen an in-progress interview** *(S, web)* — leaving the page loses the interview on screen;
  the session is intact server-side (`GET /interviews` lists it). Matters more now that leaving
  mid-answer discards the turn.
- **Per-call model timeout with fallback** *(S)* — provider clients have no request timeout; one
  grading call took 42 s and an eval run once hung for 15 minutes. Bound each call and fall back
  to the next provider when slow.
- **Charge aborted calls** *(S)* — when the client leaves while an answer is being graded, the
  ai-service finishes the call but its spend never reaches the session's counters (D-067).

## Found while building the coding engine (D-069)

- **Memory for compiled languages counts the compiler** *(S)* — `memoryKb` samples the whole
  container, so C++ reports ~230 MB for any solution (g++'s peak), Go and Rust ~55–75 MB. Sample
  only after compilation, or report compile and run separately.
- **Weak-margin test data** *(S)* — two plausible bugs are caught by very few cases: an LRU cache
  whose `get` doesn't refresh recency (5 of 50) and a number-of-islands search that never looks up
  (2 of 50). Strengthen those generators as D-042 did, to fail at least ~8 cases.

## Alternative showpieces (considered and not chosen)

- **Elo-rated adaptive difficulty** *(L, Loud)* — per-topic Elo for users *and* problems,
  selecting the next problem at ~60–70% success probability.
- **Empirical complexity detection** *(L, Loud)* — run a passing solution against
  geometrically increasing inputs, curve-fit against O(n) / O(n log n) / O(n²), then compare
  with what the LLM reviewer *claimed*. Honest empiricism rather than another model opinion.

## Engineering credibility

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

- **Safari recording** *(S)* — the real-microphone and VoiceOver checks passed in Chrome
  (D-064); Safari records `audio/mp4` and is still untried on real hardware.
