# 💻 InterviewForge

<div align="center">

**AI-powered mock interview platform — practice coding, system design, behavioral rounds, and timed assessments like the real thing. Available on web and iOS.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Swift](https://img.shields.io/badge/Swift-6.3-F05138?logo=swift&logoColor=white)](https://developer.apple.com/swift/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![SwiftUI](https://img.shields.io/badge/SwiftUI-iOS_17+-007AFF?logo=apple&logoColor=white)](https://developer.apple.com/xcode/swiftui/)
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

**InterviewForge** simulates full technical interviews the way top companies run them. Pick a company (Amazon, Google, Meta, Apple), choose a difficulty, and work through **behavioral → coding → system design → core CS** rounds — all powered by **RAG-backed LLM question generation**, with real-time evaluation and follow-ups.

On the coding side, solve problems in a **Monaco editor** (web) or **CodeMirror editor** (iOS) with code execution in **isolated Docker sandboxes** (Python, C, C++, Java). Get **AI code reviews**, track progress with **analytics & leaderboards**, follow **learning paths**, and take **timed assessments**.

The platform ships as both a **Next.js web app** and a **native SwiftUI iOS app** — both powered by the same Express + FastAPI backend.

### ✨ Key Highlights

- 🎙️ **Multi-stage AI interviews** — Company-specific questions, follow-ups, voice evaluation, and downloadable PDF reports
- 🔍 **Company-aware RAG** — Chroma vector store seeded with interview patterns for Amazon, Google, Meta, and Apple
- 💻 **Sandboxed code execution** — Run/submit user code in ephemeral Docker containers, never on the host
- 🔐 **Full auth system** — JWT tokens, bcrypt hashing, email verification, password reset
- 📊 **Practice ecosystem** — Problem bookmarks, filters, hints, editorials, submission history, streaks, heatmaps
- 🏆 **Leaderboard & analytics** — Global rankings, topic radar, difficulty distribution, acceptance trends
- 📋 **Timed assessments** — Multi-problem flows with countdown timer and scoring
- 🗺️ **Learning paths** — Curated problem sequences by topic with progress tracking
- 🏗️ **System design** — AI-analyzed architecture explanations rendered as React Flow diagrams (web) and interactive graph views (iOS)
- 📱 **Native iOS app** — Full-featured SwiftUI client with CodeMirror editor, voice recording, Swift Charts analytics, and Keychain-based auth

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

### iOS app

- Native SwiftUI app targeting iOS 17+ with full feature parity
- MVVM architecture with async/await networking layer
- JWT authentication with iOS Keychain storage
- CodeMirror code editor via WKWebView with Swift ↔ JS bridge
- Voice recording via AVFoundation for interview speech evaluation
- Interactive system design diagrams rendered in WKWebView
- Swift Charts for analytics (solved trends, difficulty distribution, topic breakdown)
- Dark mode, haptic feedback, pull-to-refresh, skeleton loading states
- PhotosPicker for avatar upload, ShareLink for PDF report sharing

---

## 🏗️ Architecture

```
┌────────────────┐                    ┌──────────────────┐        ┌────────────────┐
│                │     REST / WS      │                  │        │                │
│   Next.js      │ ◄────────────────► │  Express backend │ ◄────► │  PostgreSQL    │
│   :3000        │      /api/*        │  :4000           │        │                │
│                │                    │                  │        └────────────────┘
└───────┬────────┘                    └────────┬─────────┘
        │                              ▲       │
        │                    REST      │       │  HTTP
        │               ┌─────────────┘│       ▼
        │               │              │┌──────────────────┐        ┌────────────────┐
        │  ┌────────────────┐          ││                  │        │                │
        │  │                │          ││  FastAPI         │ ◄────► │  ChromaDB      │
        │  │  iOS App       │          ││  ai-service      │        │  (RAG vectors) │
        │  │  (SwiftUI)     │──────────┘│  :8000           │        │                │
        │  │                │           └────────┬─────────┘        └────────────────┘
        │  └────────────────┘                    │
        │                                        │  Gemini / OpenAI
        │                                        ▼
        │                            ┌──────────────────┐
        │          code submit       │                  │        ┌────────────────┐
        └──────────────────────────► │  code-runner     │ ─────► │  Docker        │
                                     │  :5000           │        │  sandboxes     │
                                     │                  │        │  (py/c/cpp/java│
                                     └──────────────────┘        └────────────────┘
```

### 🔄 Data flow

1. **Auth** — Client (web or iOS) → Express (bcrypt + JWT) → PostgreSQL `users`
2. **Code submit** — Client → Express → code-runner → ephemeral Docker container → test results → response
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

### iOS App

| | |
|---|---|
| **Language** | Swift 6.3 |
| **UI** | SwiftUI (iOS 17+), MVVM architecture |
| **Code editor** | CodeMirror 6 via WKWebView with Swift ↔ JS bridge |
| **Charts** | Swift Charts |
| **Voice** | AVFoundation (AVAudioRecorder) |
| **Diagrams** | WKWebView with vis.js graph renderer |
| **Auth storage** | iOS Keychain |
| **Networking** | URLSession with async/await |
| **Utilities** | PhotosPicker (avatar), ShareLink (PDF export) |

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
| **RAG** | LangChain + ChromaDB |
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
├── ios/                    # SwiftUI iOS app
│   └── InterviewForge/
│       ├── App/            # App entry point, ContentView, TabView root
│       ├── Models/         # Codable structs matching API responses
│       ├── Services/       # APIService, AuthManager, KeychainHelper
│       ├── ViewModels/     # ObservableObject VMs per feature
│       ├── Views/          # Auth, Dashboard, Problems, Interview, etc.
│       └── WebView/        # CodeMirror editor + diagram renderer (WKWebView)
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
├── docs/                   # smoke-test.md
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

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| AI service | http://localhost:8000 |
| Code runner | http://localhost:5050 |

### iOS app

```bash
# Open in Xcode
open ios/InterviewForge/InterviewForge.xcodeproj

# Or from the command line
cd ios/InterviewForge && xcodebuild -scheme InterviewForge -destination 'platform=iOS Simulator,name=iPhone 16'
```

> The iOS app connects to the same backend. Update the `baseURL` in `APIService.swift` to point to your machine's local IP (e.g. `http://192.168.x.x:4000/api`) when running on a simulator or device, since `localhost` from the simulator maps to the simulator itself.

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

InterviewForge is deployed on AWS Free Tier with the following setup:

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
- [x] Native iOS app (SwiftUI, full feature parity with web)
- [ ] HTTPS via Let's Encrypt (requires domain)
- [ ] CI/CD pipeline (lint, typecheck, build, deploy)
- [ ] More company interview profiles and RAG corpora
- [ ] Horizontal scaling for code-runner and ai-service
- [ ] WebSocket reconnection and offline resilience
- [ ] User profile customization and social features
- [ ] Interview session replay and sharing
- [ ] Collaborative mock interviews (peer-to-peer)

---

## 🙏 Acknowledgments

- [**Google Gemini**](https://ai.google.dev) & [**OpenAI**](https://openai.com) — LLM and embedding APIs
- [**ChromaDB**](https://www.trychroma.com) — Vector storage for RAG
- [**LangChain**](https://www.langchain.com) — LLM orchestration framework
- [**Next.js**](https://nextjs.org), [**Express**](https://expressjs.com), [**FastAPI**](https://fastapi.tiangolo.com) — Core frameworks
- The open-source community behind every dependency in this stack

---

<div align="center">

**Built with ❤️ using TypeScript, Python, Swift, Next.js, SwiftUI, Express, FastAPI, and Docker**

⭐ Star this repo if you find it helpful!

</div>
