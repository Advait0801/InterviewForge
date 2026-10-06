# Roadmap (approved 2026-10-06)

The serial plan for everything in [`BACKLOG.md`](BACKLOG.md). This file is the shared plan for
both Claude Code (backend, AI service, infra, verification) and GPT 6 (all `web/` changes).
What has shipped is recorded in [`DECISIONS.md`](DECISIONS.md). As a phase lands, its row in the
status table below changes, and its items are deleted from `BACKLOG.md`.

## How the work runs

**Who does what**
- **Claude Code** builds `backend/`, `ai-service/`, `code-runner/`, `docker/`, `scripts/`, CI and
  docs, and verifies everything, including GPT's web work.
- **GPT 6** makes **all `web/` changes**. Claude never edits `web/`.

**Per backend phase**
1. Claude states the goal and exit criteria.
2. At least 3 build → verify → refine iterations. The exit criteria, not the iteration count,
   decide when the phase is done.
3. A branch per phase: `feat/phaseN-<slug>`. A conventional commit with a title and a body (why,
   plus what was verified), pushed. Advait opens and merges the PR as a merge commit.
4. Hard pause until Advait approves the next phase.
5. Backend phases verify at the API level (route tests plus live checks against the running
   stack). New endpoints are additive, so merging before the UI exists is safe. A behaviour change
   that needs UI stays behind a flag until its group's UI lands.

**Per group, once all its backend phases are merged**
1. Claude stops and hands Advait **one GPT 6 prompt** covering all of the group's web work: the
   branch name, the goal, the endpoints and response shapes (or the generated client), the files
   involved, the acceptance criteria, and the rules below.
2. GPT works on `feat/ui-group-<x>`, cut from `main`, and commits there.
3. When Advait says it's done, Claude verifies: web tests, lint, build, a browser walkthrough of
   every flow against the live stack, and axe where relevant. Problems go back to Advait as a
   follow-up GPT prompt.
4. One PR, then a hard pause.

## Groups and phases

| Group | Phase | Size | Goal | Exit criteria |
|---|---|---|---|---|
| **A — Foundations** | 0 Perf + a11y investigation | S | Find why the homepage warm load rose 24.2 → 35.1 ms (+14.7% script bytes, D-052); audit accessibility; check mic error paths | Root cause and fix specified; axe findings listed by severity; mic denied/missing behaviour documented. Fixes outside `web/` made |
| | 1 Repository/service layer | M | SQL and business logic out of the route files | Routes delegate to services/repositories; all backend tests and the live verify scripts pass unchanged |
| | 2 OpenAPI + generated client | M | End silent drift between `web/` and the API (F-09) | Specs for Express and FastAPI; a typed TS client generated into `web/`, adopted in the UI step; CI fails on spec drift |
| | 3 Redis + BullMQ | L | Shared state and bounded work (Redis is a 7th service, approved) | Rate limits in Redis (closes F-19); code runs queued with a concurrency cap; leaderboard cached; a load test proves the cap |
| | **UI A** (GPT) | — | Homepage perf fix, a11y fixes, mic error states, `web/` switched to the generated client | Warm load ≈ baseline, measured as in `ui-ux/phase-7.md`; 0 serious axe violations on the main pages; every API call goes through the typed client |
| **B — Interviewer** | 4 SSE streaming | M | Interview text streams FastAPI → Express → browser | Streams live; disconnect and backpressure handled; the turn is still saved transactionally (D-057) |
| | 5 Interviewer upgrades | M | Personas → hint ladder (score penalty per hint) → grounded challenge (pushback when an answer contradicts retrieved context) | Each measured with the eval harness or an LLM judge; no retrieval regression |
| | 6 Agentic interviewer | L | A tool-using agent decides to probe, pivot or move on, replacing the fixed state machine | Sensible live interviews; LLM cost per interview measured and capped; the old flow behind a flag |
| | **UI B** (GPT) | — | Interview page: streaming text, persona picker, hints, pushback, agent flow | Every flow works in the browser against the live stack; honest loading/error states |
| **C — Practice** | 7 Coding engine | M | Custom test cases + failing-case diff; JavaScript, Go, Rust | New languages verified across all 150 problems the Phase-7 way; sandboxes hardened like the existing four |
| | 8 Learning features | M | Problem of the Day, SM-2 spaced repetition, weakness → auto-generated learning path | Deterministic selection; route tests; live checks |
| | 9 Sharing + integrity | M | Session replay, public report links, assessment proctoring | Public links expose no private data (tested); proctoring events recorded |
| | 10 Real email | S | Verification and reset emails actually sent (F-07) | A real email arrives; local dev still only logs |
| | **UI C** (GPT) | — | Custom tests and diff, language picker, POTD, review queue, auto paths, replay, share links, proctoring notices | Every flow verified in the browser |
| **D — Showpieces** | 11 Semantic caching | M | Reuse context for near-duplicate queries | Kept only if it wins outside the ±0.024 noise band |
| | 12 Complexity detection, then Elo | L+L | Curve-fit real runtimes and compare with the AI review's claim; Elo-rated adaptive difficulty | Correct on known O(n) / O(n log n) / O(n²) problems; Elo picks hit the target success rate |
| | 13 Peer mock interviews | L | WebRTC over the dormant Socket.IO (F-06) | Two browsers connect and complete a session |
| | **UI D** (GPT) | — | Complexity display, adaptive-difficulty UI, peer-interview room | Verified in the browser |
| — | 14 Final verification + docs | M | Both full rounds again (correctness, then resilience); README, DECISIONS, resume summary | Both rounds green |

## Status

| Group | Phase | Branch | Status |
|---|---|---|---|
| A | 0 Perf + a11y investigation | `feat/phase0-perf-a11y` | next |
| A | 1 Repository/service layer | `feat/phase1-repository-layer` | — |
| A | 2 OpenAPI + generated client | `feat/phase2-openapi-client` | — |
| A | 3 Redis + BullMQ | `feat/phase3-redis-queue` | — |
| A | UI A | `feat/ui-group-a` | — |
| B | 4 SSE streaming | `feat/phase4-sse-streaming` | — |
| B | 5 Interviewer upgrades | `feat/phase5-interviewer-upgrades` | — |
| B | 6 Agentic interviewer | `feat/phase6-agentic-interviewer` | — |
| B | UI B | `feat/ui-group-b` | — |
| C | 7 Coding engine | `feat/phase7-coding-engine` | — |
| C | 8 Learning features | `feat/phase8-learning` | — |
| C | 9 Sharing + integrity | `feat/phase9-sharing-integrity` | — |
| C | 10 Real email | `feat/phase10-email` | — |
| C | UI C | `feat/ui-group-c` | — |
| D | 11 Semantic caching | `feat/phase11-semantic-cache` | — |
| D | 12 Complexity + Elo | `feat/phase12-showpieces` | — |
| D | 13 Peer interviews | `feat/phase13-peer-interviews` | — |
| D | UI D | `feat/ui-group-d` | — |
| — | 14 Final verification + docs | `main` (docs) + a fix branch if needed | — |

## Needs from Advait

- **Phase 10:** an email provider API key (e.g. Resend).
- **Before heavy live-model runs** (phases 5, 6, 11): a spend limit, if there is one. Unit tests
  never call a live model.
- **After UI A:** a 5-minute VoiceOver and real-microphone check. Neither assistant can do these.

## Rules for GPT 6 (`web/` work)

- Work only in `web/`, on the branch the handoff names. Don't change `backend/`, `ai-service/` or
  `code-runner/`. If an API seems wrong or missing, say so instead of working around it.
- Before committing: `npm test`, `npm run lint` (blocking; it's bare `eslint`, not `next lint`),
  `npm run build`, all in `web/`.
- Keep the established UI conventions (D-045 – D-052, `docs/ui-ux/`): loading, empty, missing and
  error are distinct states with local recovery; keyboard focus, reduced motion, light and dark
  themes; responsive down to 320 px with both workspace panes kept mounted.
- Auth: sign out only on a 401 carrying `code: "session_invalid"` (D-055). Any other 401 is a form
  or request error.
- Submit results: hidden test cases arrive as `{ passed, hidden: true }`. Never expect or fetch the
  hidden suite (D-057).
- `web/.env` holds only `NEXT_PUBLIC_*` values, which are public; never put a secret there.
- The dev stack serves web on http://localhost:3002 and the API on http://localhost:4000/api.
- Commits: conventional prefix, a title **and** a body saying why and what was verified.
