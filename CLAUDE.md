# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**InterviewForge** — an AI-powered mock interview platform. Users pick a company
(10 companies: Amazon, Google, Meta, Apple, Microsoft, Uber, Bloomberg, Adobe, LinkedIn,
Airbnb) and a difficulty, then run a full technical loop:
behavioral → coding → system design → core CS, with a RAG-grounded LLM as the
interviewer. Also includes a LeetCode-style coding engine with sandboxed execution,
timed assessments, learning paths, analytics, and a leaderboard.

Next.js web app is the only client.

## Architecture — the one rule that governs everything

> **Node does orchestration and data. Python does AI. They talk over REST.**

The Express backend contains **zero** ML/LLM logic. If something needs to be
generated, evaluated, transcribed, or embedded, Express makes an HTTP call to the
FastAPI `ai-service`. Do not add LLM calls, prompts, or embedding code to `backend/`.

| Service | Tech | Port | Responsibility |
|---|---|---|---|
| `web/` | Next.js 16 (App Router), React 19, TS, Tailwind 4 | 3000 (3002 host) | UI: Monaco editor, React Flow diagrams, Recharts, PDF export |
| `backend/` | Express 5, TypeScript | 4000 | Auth, sessions, orchestration, all SQL |
| `ai-service/` | FastAPI, Python | 8000 (8010 host) | RAG, LLM chains, speech, code review, recommendations |
| `code-runner/` | Node + dockerode | 5000 (5050 host in dev) | Ephemeral Docker sandboxes for user code |
| `postgres` | PostgreSQL 16 | 5432 (5433 host in dev) | Relational data |
| `chromadb` | Chroma 0.5.5 | 8000 (8001 host) | RAG vector store |
| `redis` | Redis 7 | 6379 (6380 host) | Rate limits, code-run queue, leaderboard cache (D-063) |

A native SwiftUI iOS client was removed in Sep 2026 (see `docs/DECISIONS.md` D-007). It
remains in git history at commits `e24baf6` and `b19f09d` if it's ever needed.

## Layout that matters

```
backend/src/routes/          # HTTP only: parse, validate, call a service, map errors (http.ts helpers)
backend/src/services/        # business rules + orchestration; ai.service.ts (AI_SERVICE_URL),
#                              code-runner.client.ts, errors.ts (DomainError), *.service.ts
backend/src/repositories/    # all SQL, one file per table group; take a Queryable for transactions
backend/src/db.ts            # query() over a pg Pool, plus withTransaction()
backend/openapi/openapi.yaml # the Express API contract (D-062); served at /api/openapi.json
backend/src/generated/       # ai-service types generated from ai-service/openapi.json — never hand-edit
backend/sql_migrations/      # 001_init.sql … 016_interview_agent_cost.sql (raw SQL, ordered)
backend/leetcode_problems.json, starter_templates.json, problem_hints.json, problem_editorials.json
backend/reference_solutions/ # <slug>/solution.{py,c,cpp,java,js,go,rs}, run by scripts/verify_problems.py;
#                              the .py ones are also the runtime oracle for custom test cases
scripts/problemgen/          # problem specs + independent oracles that generate the data files
scripts/problemgen/curation.py # company tags for all 150 problems; overrides the generators (D-044)

ai-service/app/api/          # routers: rag, interview, speech, system_design, code_review,
#                              recommendations, resume
ai-service/app/llm/chains.py # ALL LangChain chains + provider fallback live here
ai-service/app/rag/          # chroma_client, chunking, embeddings, service
ai-service/app/resume/       # parser.py (PDF -> sections), store.py (per-user namespaces)
ai-service/app/interview/    # company_profiles.py, orchestrator.py (retrieval query building),
#                              agent.py (the interviewer agent's bounded JSON-step loop, D-067)
ai-service/seed_data/documents.json  # the RAG corpus

code-runner/src/runner.ts    # container lifecycle, tar packing, output comparison
code-runner/src/harness-gen.ts # per-language test harness generation
docker/sandboxes/            # python / c / cpp / java / javascript / go / rust sandbox images
```

## Conventions

**Env & Docker**
- One `.env` per service: `backend/.env`, `ai-service/.env`, `web/.env`,
  `code-runner/.env`, plus `.env.postgres` at the root. All gitignored; each has a
  committed `.env.example` template (names and placeholders only). Adding an env var
  means adding it to the template too.
- Never put env values statically in `docker-compose.yml` — use `env_file:` only.
- Every service has a `.dockerignore` that keeps `.env` out of images (D-054). The one
  exception is `web/`, whose `.env` holds only `NEXT_PUBLIC_API_URL`, inlined at build —
  never put a secret there. A new data file the backend reads at runtime must also be
  added to `backend/Dockerfile.prod`, or the CI smoke test (and prod) will miss it.
- Services talk over the compose network by hostname (`postgres`, `code-runner`,
  `ai-service`, `chromadb`, `redis`), not `localhost`. Host port bindings exist only for tools
  run from the host, so remapping them never affects service-to-service traffic.
  This machine runs another project on 3000/8000/5432, so InterviewForge's host
  bindings are offset: **web 3002, ai-service 8010, postgres 5433** (D-024, D-031, D-041).
  The other project's ports are left alone.

**Database**
- Raw SQL migrations only, numbered, in `backend/sql_migrations/`. No ORM, no
  migration tool. Adding a column means adding a new numbered file — never edit an
  applied one.
- Apply: `docker compose exec -T postgres psql -U postgres -d interviewforge -f - < backend/sql_migrations/XXX.sql`
- Never reference a column that no migration has created.

**API**
- Validate UUID path params; 400 on malformed, 404 on not found.
- Protected routes use `requireAuth` (JWT `{ userId }`, HS256, 7d); `optionalAuth`
  where solved/bookmark flags are enriched for logged-in users. `optionalAuth` also runs
  globally before `apiLimiter` so the limiter keys per user (D-053).
- Tokens carry `tv` = `users.token_version`; auth checks it on every request (one PK lookup,
  memoised per request). Bump the column to revoke a user's sessions. Session failures are
  401 with `code: "session_invalid"` — the web client signs out only on that code, so never
  add it to a 401 that isn't about the session (D-055).
- `JWT_SECRET` must be set and ≥32 chars or the backend refuses to boot — there is no
  fallback. Behind a proxy, set `TRUST_PROXY` to the hop count (D-053).
- Backend uses native `fetch` for outbound calls — no axios.

**Layering (D-061)**
- Routes → services → repositories. Routes never import `db` or hold SQL; services hold no
  SQL; repositories don't import services (except `test-cases` types). `architecture.test.ts`
  enforces this.
- A service reports an expected failure by throwing `DomainError(status, message, extra)`;
  routes send it as `{ error, ...extra }`. AI-service and code-runner failures propagate as
  their own error types and are mapped in the route.
- Repository writes that can run inside a transaction take `db: Queryable` as the first
  argument; the service owns the `withTransaction` call.

**API contract (D-062)**
- Changing an Express endpoint means changing `backend/openapi/openapi.yaml` in the same
  commit: the route-test harness validates every response against it and
  `openapi-contract.test.ts` fails if a route and the spec disagree.
- Changing a FastAPI request/response model: `docker compose exec ai-service python
  scripts/export_openapi.py`, then `cd backend && npm run gen:ai-types`, and commit both.
  pytest and `scripts/ci/check_api_contract.sh` fail otherwise.
- Request bodies to the ai-service are typed object literals in `ai.service.ts`; FastAPI
  silently drops unknown fields, so never pass a spread or untyped object.
- `OPENAPI_VALIDATE_RESPONSES=1` in `backend/.env` logs live contract violations
  (`openapi_violation`). Dev only.

**Redis (D-063)**
- `REDIS_URL` unset (unit tests) = in-memory limits, no queue, no cache: today's behaviour.
  Set but unreachable = limits fall back to memory, the cache is bypassed, the ai-service
  denies live fetches, and code runs return a retryable 503. Code runs never bypass the
  queue while `REDIS_URL` is set, or an outage would remove the concurrency cap.
- Code runs go through `services/run-queue.ts` (`CODE_RUN_CONCURRENCY`, global across
  instances). A job holds the hidden test cases, so it's deleted once its result is read.
- Redis runs with `noeviction` (BullMQ requires it) and no persistence.
- Integration tests need `REDIS_TEST_URL` (e.g. `redis://localhost:6380`); they skip without
  it. CI provides one.

**Streaming (D-065)**
- `POST /interviews/stream` and `/interviews/{id}/answer/stream` stream the question as SSE;
  the JSON endpoints stay. Input errors are JSON before the stream opens; after, the outcome is
  a `done` event (the JSON endpoint's body) or an `error` event (its status).
- The turn commits only once the whole question exists; a client leaving earlier aborts every
  ai-service call (`TurnStream.signal`) and nothing is written. Keep it that way: never commit a
  partial question.
- Every write to the client goes through `routes/sse.ts`, which waits for `drain`. Don't
  `res.write` directly, or a slow client is buffered in memory.
- `web/src/lib/api/schema.d.ts` is regenerated (never hand-edited) in the backend commit that
  changes the spec, so CI's drift check stays green.

**Agentic interviewer and cost (D-067)**
- `mode` (`fixed` | `agent`) is per session; default `INTERVIEW_MODE` (fixed until UI B). The
  agent proposes a move; the backend's rules decide (`MAX_STAGE_QUESTIONS`, finish only on the last
  stage, no stalled second probe) and anything else falls back to the fixed rule. Keep rules in
  the backend, not in the prompt: the agent ignored prompt-only rules in simulation.
- Every ai-service response reports its model calls in `x-llm-usage` (streams: in `done`/`error`).
  `services/llm-usage.ts` sums them per operation and charges the session (`llm_calls`,
  `llm_cost_usd`). A new operation that calls the ai-service on a session's behalf must run inside
  `withUsage(..., charge)`, or its spend is invisible to the cap (`INTERVIEW_COST_CAP_USD`).
- Gemini's native tool calling doesn't work with the pinned langchain-google-genai (missing
  `thought_signature`); agents use JSON steps.

**Multi-write routes**
- Writes that must land together go through `db.withTransaction` (D-057). Keep LLM calls and
  code execution *outside* it. Inside a transaction `NOW()` is frozen — use
  `clock_timestamp()` where row order matters (interview messages do).
- Only the first 4 test cases of a problem ever leave the server (`services/test-cases.ts`);
  never return `problems.test_cases` directly.

**Backend tests**
- Route tests use `src/__tests__/helpers/harness.ts`: a real router over HTTP behind the
  same middleware as `index.ts`, with Postgres replaced by a strict fake — any query no
  handler claims throws, so a route can't run unexpected SQL and still pass. Handlers match
  by substring in order, so put the more specific pattern first (D-056).
- The fakes match SQL text (some with `startsWith`), so when moving a query, move it
  verbatim. Some test files mock `db` with only `query`, so a repository should import only
  what it uses.

**AI service**
- Every chain uses `JsonOutputParser(pydantic_object=…)` with `{format_instructions}`
  injected into the prompt, so output is typed JSON, never prose.
- All calls go through `invoke_with_fallback` (Gemini → OpenAI, with per-provider
  rate-limit cooldowns). Don't call a provider SDK directly from a router.
- A prompt has exactly **one system message, and it comes first**: Gemini's client raises on
  any other, while OpenAI and the fake test model accept it (D-066). Add per-request
  instructions as a template variable inside that message.
- Gemini's free tier caps each model at **15 requests/minute and 500/day**. Past either,
  calls fall back to OpenAI silently. An eval that must measure one model pins the provider
  (`app/eval/interviewer.py` does) and paces itself.
- Interviewer prompts take `persona_instructions` (D-066); neutral is an empty string, and
  the neutral prompts are pinned by hash in `tests/test_interviewer_upgrades.py`. Grading and
  report chains never take a persona.

**Personal data in the vector store (Phase 5)**
- Resume chunks live in a **per-user Chroma collection**, never the shared corpus.
  `ResumeStore` takes `user_id` as the first argument of every method and builds the
  namespace itself — there is no API through which an unscoped operation is expressible.
- Three isolation layers (namespace, `where` filter, egress check) are deliberate
  redundancy, not belt-and-braces clutter. Don't remove one because the others cover it.
- **Read paths must never use `get_or_create_collection`** — that creates an empty
  namespace for a user who has no resume, and resurrects one after deletion (D-040).
- Changing any of this means re-running `scripts/verify_resume_isolation.py`; the unit
  suite alone has already been proven blind to three defects here.

**Code-runner**
- Languages: python3, c, cpp, java, javascript, go, rust. Images:
  `interviewforge-{python,c,cpp,java,javascript,go,rust}-sandbox:latest`, all run with the same
  `buildContainerConfig` (a test compares every language's config with Python's) (D-069).
- User code runs **only** in an ephemeral container that is removed in a `finally`.
  Never write user code to a host path, never reuse a container across requests —
  per-request isolation is what makes concurrent submissions safe.
- A job holds **at most one sandbox at a time**. A Run with custom inputs runs the Python
  reference first, then the user's code, sequentially; running them in parallel would double
  the live sandboxes past `CODE_RUN_CONCURRENCY` (D-069).
- JavaScript/Go/Rust starter code is generated from `meta` by
  `scripts/problemgen/language_templates.py` (`--check` for drift); don't hand-edit those keys.
- Harness files (`src/harnesses/*.py|.js`) aren't compiled by tsc; `Dockerfile.prod` copies them
  into `dist/harnesses`, and the smoke test generates every language's harness in the image.
- The dev code-runner's file watcher can stop reloading on the bind mount. Before a live
  check that depends on a code-runner edit, `docker compose restart code-runner`.

## Commands

```bash
docker compose up --build                    # full local stack

# migrations (in order)
for f in $(ls backend/sql_migrations/*.sql | sort); do
  docker compose exec -T postgres psql -U postgres -d interviewforge -f - < "$f"
done

docker compose exec backend npx ts-node scripts/seed_problems.ts       # seed problems
docker compose exec backend npx ts-node scripts/seed_learning_paths.ts # seed paths
docker compose exec ai-service python scripts/seed_rag.py              # seed RAG corpus

python scripts/verify_resume_isolation.py   # Phase 5: cross-user isolation + deletion, live stack
python scripts/verify_problems.py           # every problem x 7 languages via the real code-runner (1,050 cells)
python scripts/verify_coding_engine.py      # Group C Phase 7: custom inputs, diffs, hidden cases, 7 languages (D-069); live stack
python scripts/verify_phase7.py             # Phase 7: company filter, curated tags, editorials, stats/streak; live stack
python scripts/verify_streaming.py          # SSE interview streams, disconnect, 409, timings (D-065); live stack
python scripts/verify_streaming.py --measure 6  # JSON vs stream latency medians at the ai-service
python scripts/verify_interviewer.py        # personas, hint ladder + penalty, challenge wiring (D-066); live stack
docker compose exec ai-service python -m app.eval.interviewer  # persona/hint/challenge quality, ~120 Gemini calls
docker compose exec ai-service python -m app.eval.run --k 5 --no-filter --previous-answer strong  # why it stays off
python scripts/verify_agent.py              # agent-mode interview: rules, notes, cost (D-067); --cap with a tiny INTERVIEW_COST_CAP_USD
docker compose exec ai-service python -m app.eval.simulate_interviews  # 5 simulated interviews, agent vs fixed; ~150 Gemini calls
python scripts/problemgen/batch1_easy.py    # regenerate a batch's data (idempotent; see D-042)
python scripts/problemgen/apply_curation.py # write curated company tags into leetcode_problems.json
docker compose exec ai-service python -m app.eval.calibrate_confidence  # re-tune the live-fetch gate

bash scripts/ci/smoke_prod_images.sh  # prod image contents + boot; build tags first (see its header)
bash scripts/ci/check_api_contract.sh # generated API types match their specs
python scripts/load_test_run_queue.py --requests 20 --cap 4   # Phase 3: the run cap holds (D-063)
python scripts/load_test_run_queue.py --requests 20 --cap 4 --custom  # ...with two sandboxes per job (D-069)
python scripts/problemgen/language_templates.py --check      # JS/Go/Rust starter code matches the signatures
cd backend && REDIS_TEST_URL=redis://localhost:6380 npm test  # incl. queue/cache integration tests
cd backend && npm run gen:ai-types     # after re-exporting ai-service/openapi.json
cd backend && npm run gen:web-client   # writes web/src/lib/api/schema.d.ts (UI A / GPT)

cd backend && npm run build     # tsc
cd web && npm run build         # next build
```

Production: `docker-compose.prod.yml` (multi-stage `Dockerfile.prod` per service,
per-container memory limits, ports bound to 127.0.0.1 behind Nginx). This ran on AWS
EC2 t3.micro + RDS; that deployment has since been torn down (free tier expired), so
there is currently no live environment. The prod compose file and Dockerfiles are
still accurate and redeployable.

## Known gaps (don't be surprised by these)

- ~~Empty test dirs, no CI~~ — fixed in Phase 0. Vitest in `backend/`, `web/` and
  `code-runner/`, pytest in `ai-service/`; `.github/workflows/ci.yml` also builds and
  smoke-tests the four prod images and builds the four sandboxes (D-054). `web/` lint is
  blocking (F-14 closed in D-031).
- Local `docker compose up` does not build the sandbox images — build them once
  (`docker/sandboxes/*`, see README) or every code run fails.
- Prod seeding needs a one-off global `ts-node` (the backend image ships `dist/` only);
  the README deploy section has the command.
- Socket.IO is scaffolded on both ends but only emits a `hello` — realtime is unused
  (interview streaming is SSE over plain HTTP, D-065).
- Email verification / password reset tokens work, but emails are only `console.log`ed.
- ~~Sandbox runs as root with no capability/pid/cpu limits~~ — fixed in Phase 6.
  Containers now run as the unprivileged `runner` user with `CapDrop: ALL`,
  `no-new-privileges`, `PidsLimit`, `NanoCpus`, and a size-bounded exec tmpfs.
  `ReadonlyRootfs` is deliberately not set — see D-032.
- ~~`memoryKb` always null~~ — now sampled during execution. Absent for runs shorter
  than roughly one sample interval; approximate rather than exact (D-033).

## Related docs

All documentation lives in `docs/` (indexed by `docs/README.md`). `README.md` and this
file stay at the root by necessity — GitHub renders only the root README, and Claude
Code auto-discovers only the root `CLAUDE.md`.

- `README.md` — public-facing overview, setup, deployment.
- `docs/DECISIONS.md` — running log of decisions and findings. **Append to this** when a
  non-obvious call gets made; read it before re-litigating something.
- `docs/ROADMAP.md` — **the active plan** (local only, gitignored — plans never go in git):
  phase order, exit criteria, branch names, status.
  All `web/` changes are done by Advait in GPT 6 — Claude never edits `web/`; at a group's UI
  step, stop and hand over one prompt, then verify the result. GPT commits locally without
  pushing (Claude pushes after verifying), and every GPT commit ends with
  `Co-Authored-By: GPT <model name> <noreply@openai.com>`.
- `docs/BACKLOG.md` — what is deliberately not built yet (shipped items are deleted from it
  and recorded in DECISIONS; the verification rounds ran in D-058). Both phase plans (platform and UI) were retired on
  2026-09-20 once their workstreams merged; they live in git history at `4083f5e`.
- `docs/PROJECT_CONTEXT.md` — original product spec and long-term vision.
