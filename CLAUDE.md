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

A native SwiftUI iOS client was removed in Sep 2026 (see `docs/DECISIONS.md` D-007). It
remains in git history at commits `e24baf6` and `b19f09d` if it's ever needed.

## Layout that matters

```
backend/src/routes/          # one file per resource; SQL lives directly in handlers
backend/src/services/        # ai.service.ts (AI_SERVICE_URL), interview-state.service.ts
backend/src/db.ts            # single query() helper over a pg Pool
backend/sql_migrations/      # 001_init.sql … 012_query_indexes.sql (raw SQL, ordered)
backend/leetcode_problems.json, starter_templates.json, problem_hints.json, problem_editorials.json
backend/reference_solutions/ # <slug>/solution.{py,c,cpp,java}, run by scripts/verify_problems.py
scripts/problemgen/          # problem specs + independent oracles that generate the data files
scripts/problemgen/curation.py # company tags for all 150 problems; overrides the generators (D-044)

ai-service/app/api/          # routers: rag, interview, speech, system_design, code_review,
#                              recommendations, resume
ai-service/app/llm/chains.py # ALL LangChain chains + provider fallback live here
ai-service/app/rag/          # chroma_client, chunking, embeddings, service
ai-service/app/resume/       # parser.py (PDF -> sections), store.py (per-user namespaces)
ai-service/app/interview/    # company_profiles.py, orchestrator.py (retrieval query building)
ai-service/seed_data/documents.json  # the RAG corpus

code-runner/src/runner.ts    # container lifecycle, tar packing, output comparison
code-runner/src/harness-gen.ts # per-language test harness generation
docker/sandboxes/            # python / c / cpp / java sandbox images
```

## Conventions

**Env & Docker**
- One `.env` per service: `backend/.env`, `ai-service/.env`, `web/.env`,
  `code-runner/.env`, plus `.env.postgres` at the root. All gitignored.
- Never put env values statically in `docker-compose.yml` — use `env_file:` only.
- Every service has a `.dockerignore` that keeps `.env` out of images (D-054). The one
  exception is `web/`, whose `.env` holds only `NEXT_PUBLIC_API_URL`, inlined at build —
  never put a secret there. A new data file the backend reads at runtime must also be
  added to `backend/Dockerfile.prod`, or the CI smoke test (and prod) will miss it.
- Services talk over the compose network by hostname (`postgres`, `code-runner`,
  `ai-service`, `chromadb`), not `localhost`. Host port bindings exist only for tools
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
- `JWT_SECRET` must be set and ≥32 chars or the backend refuses to boot — there is no
  fallback. Behind a proxy, set `TRUST_PROXY` to the hop count (D-053).
- Backend uses native `fetch` for outbound calls — no axios.

**AI service**
- Every chain uses `JsonOutputParser(pydantic_object=…)` with `{format_instructions}`
  injected into the prompt, so output is typed JSON, never prose.
- All calls go through `invoke_with_fallback` (Gemini → OpenAI, with per-provider
  rate-limit cooldowns). Don't call a provider SDK directly from a router.

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
- Languages: python, c, cpp, java. Images: `interviewforge-{lang}-sandbox:latest`.
- User code runs **only** in an ephemeral container that is removed in a `finally`.
  Never write user code to a host path, never reuse a container across requests —
  per-request isolation is what makes concurrent submissions safe.

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
python scripts/verify_problems.py           # Phase 7: every problem x 4 languages via the real code-runner
python scripts/verify_phase7.py             # Phase 7: company filter, curated tags, editorials, stats/streak; live stack
python scripts/problemgen/batch1_easy.py    # regenerate a batch's data (idempotent; see D-042)
python scripts/problemgen/apply_curation.py # write curated company tags into leetcode_problems.json
docker compose exec ai-service python -m app.eval.calibrate_confidence  # re-tune the live-fetch gate

bash scripts/ci/smoke_prod_images.sh  # prod image contents + boot; build tags first (see its header)

cd backend && npm run build     # tsc
cd web && npm run build         # next build
```

Production: `docker-compose.prod.yml` (multi-stage `Dockerfile.prod` per service,
per-container memory limits, ports bound to 127.0.0.1 behind Nginx). This ran on AWS
EC2 t3.micro + RDS; that deployment has since been torn down (free tier expired), so
there is currently no live environment. The prod compose file and Dockerfiles are
still accurate and redeployable.

## Known gaps (don't be surprised by these)

- ~~Empty test dirs, no CI~~ — fixed in Phase 0. Vitest in `backend/` and `code-runner/`,
  pytest in `ai-service/`, GitHub Actions in `.github/workflows/ci.yml`. `web/` lint is
  blocking; the four pre-existing react-hooks errors were fixed in D-031 (F-14 closed).
- Socket.IO is scaffolded on both ends but only emits a `hello` — realtime is unused.
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
- `docs/BACKLOG.md` — what is deliberately not built yet, plus the two full verification
  rounds that have never been run. Both phase plans (platform and UI) were retired on
  2026-09-20 once their workstreams merged; they live in git history at `4083f5e`.
- `docs/PROJECT_CONTEXT.md` — original product spec and long-term vision.
