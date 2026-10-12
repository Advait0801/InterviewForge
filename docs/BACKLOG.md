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

## Found while building the learning features (D-070)

- **Topic names are inconsistent** *(S)* — problems use both `BFS` and `breadth-first-search`,
  `DFS` and `depth-first-search`, so the weakness score and the personal path treat them as
  different topics. Normalise the topic vocabulary in `scripts/problemgen/` (one canonical name
  each) and re-seed.
- **Self-graded reviews** *(S)* — the review queue grades recall from submissions only (pass,
  failures, hints). SM-2 normally lets the learner grade themselves too ("easy" / "hard"); worth
  adding once the UI shows the queue.

## Found while building sharing and integrity (D-071)

- **Share an assessment, not only an interview** *(S)* — public links cover interviews. An
  assessment's score, problems and integrity summary could use the same token mechanism.
- **Retention for proctoring events** *(S)* — `assessment_events` keeps everything forever. Drop
  raw events some months after submission and keep only the summary.

## Found while wiring real email (D-072)

- **A sending domain** *(S)* — Resend's shared test sender delivers only to the account owner's
  address, and Gmail filed the first test email under Spam. Before real users: verify an owned
  domain in Resend (SPF, DKIM, DMARC) and set `EMAIL_FROM` to it.
- **Read delivery status** *(S)* — the send-only key can't query Resend for bounces. A webhook
  (`email.bounced`, `email.complained`) would let the account page show "your address bounced".

## Found in Phase 12 (D-076, D-077)

- **C design inputs over 64 KB** *(S)* — Phase 12 made C read regular arguments of any length,
  but the design-problem harness still reads its ops and args lines into fixed buffers. Design
  inputs are short today; a custom design input near the limit would be split.
- **More problems with growing inputs** *(M)* — complexity measurement covers 30 curated
  problems. Trees, graphs, matrices and intervals with constraints need their own generators.
- **Elo cold start** *(S)* — until problems have been played, their ratings are their labels'
  (1200/1500/1800), so a new user's first pick is a 50% medium rather than a 65% one. Seeding
  problem ratings from acceptance rates, once there is traffic, would spread them from day one.
- **Pre-existing web type errors in tests** *(S)* — `npx tsc --noEmit` in `web/` reports 4 errors
  in `src/app/__tests__/group-c.test.tsx` (testing-library's `exact` option). `next build` and
  vitest don't typecheck tests, so nothing catches them.

## Engineering credibility


## Product

- **Peer mock interviews** *(L)* — WebRTC over the dormant Socket.IO (F-06).

## Carried over from the UI workstream

- **Safari recording** *(S)* — the real-microphone and VoiceOver checks passed in Chrome
  (D-064); Safari records `audio/mp4` and is still untried on real hardware.
