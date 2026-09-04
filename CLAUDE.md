# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**InterviewForge** — an AI-powered mock interview platform. Users pick a company
(Amazon / Google / Meta / Apple) and a difficulty, then run a full technical loop:
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
| `web/` | Next.js 16 (App Router), React 19, TS, Tailwind 4 | 3000 | UI: Monaco editor, React Flow diagrams, Recharts, PDF export |
| `backend/` | Express 5, TypeScript | 4000 | Auth, sessions, orchestration, all SQL |
| `ai-service/` | FastAPI, Python | 8000 | RAG, LLM chains, speech, code review, recommendations |
| `code-runner/` | Node + dockerode | 5000 (5050 host in dev) | Ephemeral Docker sandboxes for user code |
| `postgres` | PostgreSQL 16 | 5432 | Relational data |
| `chromadb` | Chroma 0.5.5 | 8000 (8001 host) | RAG vector store |

A native SwiftUI iOS client was removed in Sep 2026 (see `docs/DECISIONS.md` D-007). It
remains in git history at commits `e24baf6` and `b19f09d` if it's ever needed.

## Layout that matters

```
backend/src/routes/          # one file per resource; SQL lives directly in handlers
backend/src/services/        # ai.service.ts (AI_SERVICE_URL), interview-state.service.ts
backend/src/db.ts            # single query() helper over a pg Pool
backend/sql_migrations/      # 001_init.sql … 010_learning_paths.sql (raw SQL, ordered)
backend/leetcode_problems.json, starter_templates.json, problem_hints.json

ai-service/app/api/          # routers: rag, interview, speech, system_design, code_review, recommendations
ai-service/app/llm/chains.py # ALL LangChain chains + provider fallback live here
ai-service/app/rag/          # chroma_client, chunking, embeddings, service
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
- Services talk over the compose network by hostname (`postgres`, `code-runner`,
  `ai-service`, `chromadb`), not `localhost`.

**Database**
- Raw SQL migrations only, numbered, in `backend/sql_migrations/`. No ORM, no
  migration tool. Adding a column means adding a new numbered file — never edit an
  applied one.
- Apply: `docker compose exec -T postgres psql -U postgres -d interviewforge -f - < backend/sql_migrations/XXX.sql`
- Never reference a column that no migration has created.

**API**
- Validate UUID path params; 400 on malformed, 404 on not found.
- Protected routes use `requireAuth` (JWT `{ userId }`, HS256, 7d); `optionalAuth`
  where solved/bookmark flags are enriched for logged-in users.
- Backend uses native `fetch` for outbound calls — no axios.

**AI service**
- Every chain uses `JsonOutputParser(pydantic_object=…)` with `{format_instructions}`
  injected into the prompt, so output is typed JSON, never prose.
- All calls go through `invoke_with_fallback` (Gemini → OpenAI, with per-provider
  rate-limit cooldowns). Don't call a provider SDK directly from a router.

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

cd backend && npm run build     # tsc
cd web && npm run build         # next build
```

Production: `docker-compose.prod.yml` (multi-stage `Dockerfile.prod` per service,
per-container memory limits, ports bound to 127.0.0.1 behind Nginx). This ran on AWS
EC2 t3.micro + RDS; that deployment has since been torn down (free tier expired), so
there is currently no live environment. The prod compose file and Dockerfiles are
still accurate and redeployable.

## Known gaps (don't be surprised by these)

- `backend/src/__tests__/` and `ai-service/tests/` exist but are **empty** — there is
  no test runner wired up in either service.
- No CI. Deploys are a manual `git pull` + `docker compose up -d --build` on EC2.
- Socket.IO is scaffolded on both ends but only emits a `hello` — realtime is unused.
- Email verification / password reset tokens work, but emails are only `console.log`ed.
- `code-runner` sets `NetworkDisabled` and a 256 MiB memory cap, but still runs
  containers as `root` with no `CapDrop`, `no-new-privileges`, `PidsLimit`, or CPU quota.
- `memoryKb` on submissions is never measured (always null).
- README's repo-layout block lists `docs/smoke-test.md`, which never existed.

## Related docs

All documentation lives in `docs/` (indexed by `docs/README.md`). `README.md` and this
file stay at the root by necessity — GitHub renders only the root README, and Claude
Code auto-discovers only the root `CLAUDE.md`.

- `README.md` — public-facing overview, setup, deployment.
- `docs/DECISIONS.md` — running log of decisions and findings. **Append to this** when a
  non-obvious call gets made; read it before re-litigating something.
- `docs/EXECUTION_PLAN.md` — **read this first.** The active plan: phases, iteration loops,
  exit criteria, the working agreement (commit style, pause protocol, branch), and the
  parked backlog. Follow it.
- `docs/INTERVIEW_NOTES.md` — deep walkthrough of every subsystem.
- `docs/PROJECT_CONTEXT.md` — original product spec and long-term vision.
