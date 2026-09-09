# 💻 InterviewForge

<div align="center">

**AI-powered mock interview platform — practice coding, system design, behavioral rounds, and timed assessments like the real thing.**

**Built around a measured RAG pipeline: retrieval quality is evaluated on a golden set, not asserted.**

[![CI](https://github.com/Advait0801/InterviewForge/actions/workflows/ci.yml/badge.svg)](https://github.com/Advait0801/InterviewForge/actions/workflows/ci.yml)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![ChromaDB](https://img.shields.io/badge/Chroma-0.5.5-7C3AED)](https://www.trychroma.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![LangChain](https://img.shields.io/badge/LangChain-RAG-EC6227)](https://www.langchain.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

</div>

---

## 📱 Overview

**InterviewForge** simulates full technical interviews the way top companies run them. Pick a company (10 supported, from Amazon and Google to Microsoft, Uber and Bloomberg), choose a difficulty, and work through **behavioral → coding → system design → core CS** rounds — all powered by **RAG-backed LLM question generation**, with real-time evaluation and follow-ups.

On the coding side, solve problems in a **Monaco editor** with code execution in **isolated Docker sandboxes** (Python, C, C++, Java). Get **AI code reviews**, track progress with **analytics & leaderboards**, follow **learning paths**, and take **timed assessments**.

### 📈 Retrieval quality, measured

The RAG pipeline is evaluated against a hand-labelled golden set of 42 queries, so every
change is a number rather than an opinion. Full method and results in
[`docs/eval/`](docs/eval/); the reasoning behind each decision is in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

| Metric | Before | After | |
|---|---|---|---|
| nDCG@5 | 0.771 | **0.901** | +0.130 |
| Hit rate@5 | 0.833 | **0.952** | +0.119 |
| MRR | 0.782 | **0.917** | +0.135 |
| p50 latency | 210 ms | **268 ms** | +58 ms |

What produced that, in order of contribution:

- **Per-stage query routing** — behavioural and system-design questions go through an LLM
  reranker; coding and core-CS questions go through hybrid BM25 + RRF, where precise
  terminology matters. Equal quality to reranking everything, at **6.6× lower p50 latency**.
- **Hybrid search with Reciprocal Rank Fusion** — dense retrieval is weak on rare exact
  tokens; BM25 is not. RRF fuses them on rank alone, so no score normalisation is needed.
- **Structural chunking** — splits on document structure instead of character counts, so a
  section is not cut mid-argument.
- **Small-to-big retrieval** — embeds small chunks for precision, returns the wider passage
  for context.

**Two techniques were implemented, measured, and reverted** because the numbers said so:
contextual retrieval (it duplicates what structural chunking already provides) and MMR.
Those results are written up too — see [`docs/eval/phase2.md`](docs/eval/phase2.md) and
[`docs/eval/phase3.md`](docs/eval/phase3.md).

### ✨ Key Highlights

- 🎙️ **Multi-stage AI interviews** — Company-specific questions, follow-ups, voice evaluation, and downloadable PDF reports
- 🔍 **Company-aware RAG** — Chroma vector store covering 10 companies, with retrieval
  filtered by company and interview stage
- 📐 **Evaluation harness** — golden-set retrieval metrics (nDCG, MRR, hit rate, recall) plus
  an LLM-judge calibration test that asserts weak < mediocre < strong answers
- 🌐 **Self-expanding corpus** — low-confidence retrieval triggers a live web fetch that is
  cleaned, deduplicated and **written back** to the vector store, so the first user to ask
  about a thin topic pays the latency and everyone after does not
- 💻 **Sandboxed code execution** — Run/submit user code in ephemeral Docker containers, never on the host
- 🔐 **Full auth system** — JWT tokens, bcrypt hashing, email verification, password reset
- 📊 **Practice ecosystem** — Problem bookmarks, filters, hints, editorials, submission history, streaks, heatmaps
- 🏆 **Leaderboard & analytics** — Global rankings, topic radar, difficulty distribution, acceptance trends
- 📋 **Timed assessments** — Multi-problem flows with countdown timer and scoring
- 🗺️ **Learning paths** — Curated problem sequences by topic with progress tracking
- 🏗️ **System design** — AI-analyzed architecture explanations rendered as React Flow diagrams

---

## 🧩 Features

### Coding engine

- Problem list with difficulty/topic/solved filters and search
- Monaco-based code editor with syntax highlighting
- **Run** (subset of tests) and **Submit** (full suite) modes
- Submission history with language, status, runtime
- Progressive hints and editorials
- AI-powered code review (complexity, quality, optimizations)
- Bookmarking and solved-state tracking

### AI interview simulator

- Choose company (**Amazon / Google / Meta / Apple**) and difficulty (**Easy / Medium / Hard**)
- 4-stage flow: Behavioral → Coding → System Design → Core CS
- RAG-retrieved context feeds the LLM for realistic, company-styled questions
- Real-time evaluation with follow-up questions
- Voice recording → transcription → explanation scoring
- Session report with per-stage scores, strengths, weaknesses, recommendations
- **One-click PDF export** of the full report + transcript

### Platform

- Dashboard with stats, activity heatmap, and AI-recommended problems
- Global leaderboard (problems solved, acceptance rate)
- Analytics page with charts (solved over time, difficulty pie, topic radar)
- Structured learning paths with progress tracking
- Timed assessment mode with scoring
- Dark mode, responsive layouts, loading skeletons, error boundaries

---

## 🏗️ Architecture

```
┌────────────────┐                    ┌──────────────────┐        ┌────────────────┐
│                │     REST / WS      │                  │        │                │
│   Next.js      │ ◄────────────────► │  Express backend │ ◄────► │  PostgreSQL    │
│   :3000        │      /api/*        │  :4000           │        │                │
│                │                    │                  │        └────────────────┘
└────────────────┘                    └────────┬─────────┘
                                   REST │      │ REST
                          ┌─────────────┘      └──────────────┐
                          ▼                                   ▼
              ┌──────────────────┐                  ┌──────────────────┐
              │                  │  ┌────────────┐  │                  │
              │  FastAPI         │─►│  ChromaDB  │  │  code-runner     │
              │  ai-service      │  │ (RAG vecs) │  │  :5000           │
              │  :8000           │  └────────────┘  │                  │
              └────────┬─────────┘                  └────────┬─────────┘
                       │  Gemini / OpenAI                    │  Docker Engine API
                       ▼                                     ▼
              ┌──────────────────┐                  ┌──────────────────┐
              │  LLM +           │                  │  Docker sandboxes│
              │  embeddings APIs │                  │  (py/c/cpp/java) │
              └──────────────────┘                  └──────────────────┘
```
### 🔄 Data flow

1. **Auth** — Web client → Express (bcrypt + JWT) → PostgreSQL `users`
2. **Code submit** — Web client → Express → code-runner → ephemeral Docker container → test results → response
3. **Interview question** — Express → FastAPI → Chroma retrieval + LLM chain → structured question → stored in `interview_messages`
4. **RAG pipeline** — Seed documents → chunking → embeddings → Chroma → filtered retrieval by company + stage + difficulty calibration

---

## 🛠️ Tech Stack

### Frontend (Web)

| | |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, Framer Motion animations |
| **Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Diagrams** | React Flow (`@xyflow/react`) |
| **Charts** | Recharts |
| **Realtime** | Socket.IO client |
| **Utilities** | Sonner (toasts), jsPDF (report export) |

### Backend (Node.js)

| | |
|---|---|
| **Framework** | Express 5, TypeScript |
| **Auth** | JWT (`jsonwebtoken`), bcrypt |
| **Database** | PostgreSQL via `pg` |
| **Realtime** | Socket.IO |
| **Security** | `express-rate-limit`, CORS |

### AI Service (Python)

| | |
|---|---|
| **Framework** | FastAPI, Uvicorn |
| **LLM** | Gemini 2.5 Flash (primary), GPT-4o-mini (fallback) |
| **RAG** | LangChain + ChromaDB, hybrid BM25 + RRF, LLM reranking, per-stage routing |
| **Evaluation** | Golden-set harness (nDCG / MRR / hit rate), LLM-judge calibration, context-sufficiency rubric |
| **Embeddings** | Google `text-embedding-004` or OpenAI `text-embedding-3-small` |

### Execution & Data

| | |
|---|---|
| **Code runner** | Node.js service using Docker Engine API |
| **Sandboxes** | Per-language images (`docker/python`, `docker/c`, `docker/cpp`, `docker/java`) |
| **Database** | PostgreSQL 16 — 10 migrations covering users, problems, submissions, interviews, assessments, paths, bookmarks |
| **Vector store** | ChromaDB 0.5.5 |
| **Orchestration** | Docker Compose (6 services) |

---

## 📂 Repository Layout

```
InterviewForge/
├── web/                    # Next.js frontend
│   └── src/app/            # App Router pages (dashboard, problems, interview, etc.)
├── backend/                # Express API server
│   ├── src/routes/         # Auth, problems, submissions, interviews, assessments, etc.
│   ├── sql_migrations/     # 001_init.sql through 010_learning_paths.sql
│   └── scripts/            # seed_problems.ts, seed_learning_paths.ts
├── ai-service/             # FastAPI AI backend
│   ├── app/api/            # RAG, interview, code-review, speech, recommendations
│   ├── app/interview/      # Company profiles, orchestrator
│   ├── app/llm/            # LLM chains (question, evaluation, report, etc.)
│   ├── app/rag/            # Chroma client, chunking, embeddings, service
│   ├── seed_data/          # documents.json (RAG corpus)
│   └── scripts/            # seed_rag.py
├── code-runner/            # Sandbox orchestration service
├── docker/                 # Sandbox Dockerfiles (python, c, cpp, java)
├── docs/                   # EXECUTION_PLAN, DECISIONS, INTERVIEW_NOTES, PROJECT_CONTEXT
├── docker-compose.yml      # Local development stack
└── docker-compose.prod.yml # Production stack (AWS)
```

---

## 🚀 Getting Started

### Prerequisites

- **Docker** + **Docker Compose**
- API keys for **Gemini** and/or **OpenAI** (for the ai-service)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Advait0801/InterviewForge.git
cd InterviewForge

# 2. Copy environment files and fill in your secrets
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
cp web/.env.example web/.env
cp code-runner/.env.example code-runner/.env
# Also configure .env.postgres with your Postgres credentials

# 3. Start everything
docker compose up --build
```

### Access

> Host ports are deliberately offset (3001, 8010, 5433) so the stack can run
> alongside other local projects. Services address each other over the compose
> network on their container ports, so these mappings affect only the host.

| Service | URL |
|---------|-----|
| Web app | http://localhost:3001 |
| Backend API | http://localhost:4000 |
| AI service | http://localhost:8010 |
| Code runner | http://localhost:5050 |

### Database setup

```bash
# Apply all migrations in order
for f in $(ls backend/sql_migrations/*.sql | sort); do
  docker compose exec -T postgres psql -U postgres -d interviewforge -f - < "$f"
done

# Seed coding problems
docker compose exec backend npx ts-node scripts/seed_problems.ts

# Seed RAG knowledge base
docker compose exec ai-service python scripts/seed_rag.py

# Expand the corpus from curated engineering-blog feeds
docker compose exec ai-service python -m app.ingest.batch --limit 4
```

### Running the evaluation

```bash
# Retrieval metrics against the 42-query golden set (no LLM calls, so this is free)
docker compose exec ai-service python -m app.eval.run --k 5 --no-filter

# Judge calibration: asserts weak < mediocre < strong for the same question
docker compose exec ai-service python -m app.eval.monotonicity --replay app/eval/fixtures/monotonicity.json

# Context sufficiency (uses an LLM judge, so this one costs money)
docker compose exec ai-service python -m app.eval.sufficiency --window 0 --window 1
```

### Tests

```bash
cd backend      && npm test    # Vitest
cd code-runner  && npm test    # Vitest
docker compose exec ai-service python -m pytest
```

---

## 🔄 How It Works

### 1. Sign up / Log in

Register with username, email, and password. Express hashes with **bcrypt**, returns a **JWT**. Email verification and password reset flows are built in. All protected routes require `Authorization: Bearer <token>`.

### 2. Solve coding problems

Browse the problem list with filters (difficulty, topic, solved status, search). Open a problem → write code in the **Monaco editor** → **Run** to test against sample cases → **Submit** to run the full test suite. Code executes inside an **isolated Docker container** — never on the host. Request an **AI code review** for complexity analysis and optimization suggestions.

### 3. Take a mock interview

Select a company (**Amazon / Google / Meta / Apple**) and difficulty level. The platform creates a session and generates the first question using **RAG retrieval** from the company's interview knowledge base + **LLM generation** with company-specific style and difficulty calibration.

Work through **4 stages**: Behavioral → Coding → System Design → Core CS. Each answer is evaluated; follow-up questions dig deeper. On completion, generate a **full report** with per-stage scores and download it as a **PDF**.

### 4. Track your progress

The **dashboard** shows solve stats, current streak, and an activity heatmap. **Analytics** breaks down your performance by difficulty, topic, and acceptance rate over time. The **leaderboard** ranks users globally. **Learning paths** give structured problem sequences to follow.

---

## ☁️ AWS Deployment

InterviewForge **was deployed on AWS Free Tier** with the setup below. The environment
has since been torn down (free tier expired), so there is no live instance today —
but `docker-compose.prod.yml` and the `Dockerfile.prod` files are accurate and the
stack is redeployable as documented.

### Infrastructure

| Resource | Spec |
|----------|------|
| **EC2** | `t3.micro` (1 vCPU, 1 GB RAM + 2 GB swap), Amazon Linux 2023, 30 GB gp3 |
| **RDS** | `db.t3.micro`, PostgreSQL 16, 20 GB gp2 (private subnet) |
| **Networking** | Elastic IP, Nginx reverse proxy, security groups restricting DB access to EC2 only |

### Production stack

The production setup uses `docker-compose.prod.yml` with multi-stage `Dockerfile.prod` files for each service:

- **Compiled builds** — TypeScript compiled to JS, Next.js pre-built, no hot-reload
- **Multi-stage images** — dev dependencies stripped from final images
- **Memory limits** — backend 200m, ai-service 300m, code-runner 150m, web 250m, chromadb 200m
- **Restart policies** — `unless-stopped` on all containers
- **Localhost-bound ports** — Nginx handles all public traffic on port 80

### Deploy from scratch

```bash
# SSH into EC2
ssh -i interviewforge-key.pem ec2-user@<ELASTIC_IP>

# Clone and configure
git clone <repo-url> ~/InterviewForge && cd ~/InterviewForge
# Create .env files for each service (backend, ai-service, code-runner, web)

# Build sandbox images
docker build -t interviewforge-python-sandbox:latest docker/sandboxes/python-sandbox/
docker build -t interviewforge-c-sandbox:latest docker/sandboxes/c-sandbox/
docker build -t interviewforge-cpp-sandbox:latest docker/sandboxes/cpp-sandbox/
docker build -t interviewforge-java-sandbox:latest docker/sandboxes/java-sandbox/

# Start all services
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations against RDS
for f in $(ls backend/sql_migrations/*.sql | sort); do
  PGPASSWORD='<pass>' psql -h <RDS_ENDPOINT> -U postgres -d interviewforge -f "$f"
done

# Seed data
docker compose -f docker-compose.prod.yml exec backend sh -c \
  "npm install -g ts-node typescript @types/node && \
   ln -s /app/dist /app/src 2>/dev/null; \
   ts-node --skip-project --compiler-options '{\"module\":\"commonjs\"}' scripts/seed_problems.ts"
```

### Update after code changes

```bash
cd ~/InterviewForge && git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🚧 Roadmap

- [x] Production Docker Compose with multi-stage builds
- [x] AWS deployment (EC2 + RDS + Nginx)
- [x] CI pipeline (lint, typecheck, test, build) across all four services
- [x] Test suites — 324 tests in `ai-service`, plus `backend` and `code-runner`
- [x] RAG evaluation harness with a committed baseline
- [x] Retrieval quality work: structural chunking, hybrid search, reranking, routing
- [x] Live corpus ingestion with provenance and write-back caching
- [x] Expanded from 4 to 10 company interview profiles
- [ ] Sandbox hardening (drop root, `CapDrop`, `PidsLimit`, CPU quota)
- [ ] Resume-grounded personalised interviews
- [ ] HTTPS via Let's Encrypt (requires domain)
- [ ] Horizontal scaling for code-runner and ai-service
- [ ] WebSocket reconnection and offline resilience
- [ ] User profile customization and social features
- [ ] Interview session replay and sharing
- [ ] Collaborative mock interviews (peer-to-peer)

---

## 📚 Documentation

| Doc | What it covers |
|---|---|
| [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md) | The phased plan, exit criteria, and the parked backlog |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Append-only log of every non-obvious decision and finding, with the reasoning |
| [`docs/eval/`](docs/eval/) | Retrieval baselines and per-phase results, including the negative ones |
| [`docs/INTERVIEW_NOTES.md`](docs/INTERVIEW_NOTES.md) | Deep walkthrough of every subsystem |

---

## 🙏 Acknowledgments

- [**Google Gemini**](https://ai.google.dev) & [**OpenAI**](https://openai.com) — LLM and embedding APIs
- [**ChromaDB**](https://www.trychroma.com) — Vector storage for RAG
- [**LangChain**](https://www.langchain.com) — LLM orchestration framework
- [**Next.js**](https://nextjs.org), [**Express**](https://expressjs.com), [**FastAPI**](https://fastapi.tiangolo.com) — Core frameworks
- The open-source community behind every dependency in this stack

---

<div align="center">

**Built with ❤️ using TypeScript, Python, Next.js, Express, FastAPI, and Docker**

⭐ Star this repo if you find it helpful!

</div>
