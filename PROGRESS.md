# InterviewForge — Progress Tracker

> **Start Date**: March 12, 2026
> **Target Completion**: April 12, 2026
> **Stack**: Next.js · Express · FastAPI · Gemini 2.5 Flash · GPT-4o-mini · ChromaDB · PostgreSQL · Docker

---

## Week 1: Docker Infrastructure & Backend Core (Days 1–7)

### Day 1–2: Scaffolding & Docker
- [x] Initialize monorepo structure (`backend/`, `ai-service/`, `code-runner/`, `frontend/`, `docker/`)
- [x] Create `docker-compose.yml` (backend, ai-service, chromadb, postgres, code-runner)
- [x] Write Dockerfiles for each service (dev-friendly with hot reload)
- [x] Create `.env.example` with all config variables
- [x] Add `/health` endpoint to every service
- [x] Verify: `docker-compose up` brings up all services

### Day 3–4: Database, Auth & User Management
- [ ] Define Prisma schema (users, sessions, problems, submissions, scores)
- [ ] Run initial migration (`prisma migrate dev`)
- [ ] Implement JWT auth (register, login, refresh token, auth middleware)
- [ ] Build user routes (`/api/auth/register`, `/api/auth/login`, `/api/users/me`)
- [ ] Verify: register + login returns JWT, protected routes work

### Day 5–7: Coding Problems API & Code Runner
- [ ] Create seed data: 15–20 coding problems with test cases (JSON)
- [ ] Build problems API (`GET /api/problems`, `GET /api/problems/:id`)
- [ ] Build submissions API (`POST /api/submissions`)
- [ ] Implement code-runner service (Docker SDK, sandbox execution)
- [ ] Create sandbox Dockerfiles (`python-sandbox`, `node-sandbox`)
- [ ] Verify: submit code via curl → get test results back

---

## Week 2: AI Service, RAG & Interview Agent (Days 8–14)

### Day 8–9: LLM Integration & RAG Pipeline
- [ ] Build `LLMService` abstraction (Gemini primary, GPT-4o-mini fallback)
- [ ] Set up LangChain chains (question generation, evaluation, follow-ups)
- [ ] Implement document ingestion pipeline (load → chunk → embed → Chroma)
- [ ] Seed knowledge base with interview content
- [ ] Build RAG query endpoint (`POST /api/rag/query`)
- [ ] Verify: RAG returns relevant interview context

### Day 10–11: Interview Orchestrator Agent
- [ ] Build interview state machine (Behavioral → Coding → System Design → CS → Report)
- [ ] Implement session management (create/resume, persist history)
- [ ] Add dynamic follow-up question generation
- [ ] Create company profile configs (Amazon, Google, Meta)
- [ ] Wire company context into RAG retrieval
- [ ] Verify: start interview session → get AI questions → submit answers

### Day 12–14: Speech, System Design Analysis & Evaluation
- [ ] Integrate Whisper for speech-to-text (`POST /api/speech/transcribe`)
- [ ] Build voice explanation evaluation (transcribe → LLM scores)
- [ ] Build system design analysis (extract components from description)
- [ ] Implement evaluation/scoring engine (per-section rubric)
- [ ] Verify: upload audio → get transcription + AI feedback

---

## Week 3: Frontend — UI Shell & Core Flows (Days 15–21)

### Day 15–16: Project Setup & Design System
- [ ] Initialize Next.js 14 with App Router + Tailwind
- [ ] Set up dark-mode-first design tokens (colors, typography, spacing)
- [ ] Build layout components (navbar, sidebar, footer, page wrapper)
- [ ] Build landing page (hero, features, CTA)

### Day 17–18: Auth & Dashboard
- [ ] Build login/register pages with form validation
- [ ] Implement JWT storage + protected route middleware
- [ ] Build dashboard with interview mode cards
- [ ] Build user profile/settings page

### Day 19–21: Coding Interview UI & Interview Chat
- [ ] Build problem list page (filterable, difficulty badges)
- [ ] Build problem detail page with Monaco Editor (split-pane)
- [ ] Build submission results display (pass/fail, runtime, AI analysis)
- [ ] Build interview chat UI (message bubbles, typing indicator)
- [ ] Build audio recording UI (MediaRecorder API)
- [ ] Verify: full flow works end-to-end in browser

---

## Week 4: System Design, OA Mode & Polish (Days 22–30)

### Day 22–23: System Design Module UI
- [ ] Build system design prompts page
- [ ] Wire text + voice input for architecture descriptions
- [ ] Integrate React Flow for auto-generated diagrams
- [ ] Build AI feedback panel (completeness, scalability, trade-offs)

### Day 24–25: Online Assessment Mode
- [ ] Build OA session creation (time limit, problem selection)
- [ ] Build countdown timer UI with auto-submit
- [ ] Build multi-problem navigation (tabs/sidebar)
- [ ] Build OA evaluation report page

### Day 26–28: Evaluation Reports & History
- [ ] Build interview report page (scores, radar chart, strengths/weaknesses)
- [ ] Build submission history page
- [ ] Add report export/download

### Day 29–30: Final Polish
- [ ] Add animations (Framer Motion transitions, micro-interactions)
- [ ] Add error handling (toasts, graceful fallbacks)
- [ ] Make responsive (mobile-friendly)
- [ ] Write README with setup guide + architecture diagram
- [ ] Record demo video/GIF

---

## Notes

_Add any notes, blockers, or changes here as you go._

-
