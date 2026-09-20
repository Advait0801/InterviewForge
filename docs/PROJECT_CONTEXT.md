# InterviewForge — Project Context

## Overview

InterviewForge is an AI-powered platform that simulates real Software Engineering interviews.
The system allows users to practice coding interviews, system design discussions, behavioral questions, and online coding assessments in a realistic environment.

The platform acts as an AI interviewer that asks questions, evaluates answers, and provides feedback.

The goal is to replicate real interview processes used by major technology companies while helping users improve their problem-solving and communication skills.

---

## Core Features

### 1. AI Interview Simulation

The platform simulates complete technical interviews.

Example flow:

Start Interview
→ Behavioral Question
→ Coding Question
→ Follow-up Questions
→ System Design Question
→ Core CS Questions
→ Final Evaluation Report

The AI interviewer should dynamically adapt questions based on the user’s responses.

---

### 2. Coding Interview Engine

Users solve algorithmic coding problems similar to those found on platforms like LeetCode.

Features include:

* coding problem display
* code editor support
* code file upload
* test case execution
* runtime and memory metrics
* result evaluation

All code must run in a secure sandbox environment using Docker.

Execution flow:

User Code
→ Sandbox Container
→ Compile / Run
→ Test Cases
→ Result Output

---

### 3. Online Assessment Mode

The system should simulate company-style coding assessments.

Example:

Duration: 90 minutes
Questions: 2–3 coding problems

Features include:

* assessment timer
* multiple questions
* submission system
* automated evaluation
* score reports

---

### 4. System Design Interview Practice

Users should be able to practice system design interviews.

Example prompt:

"Design a scalable URL shortener."

The platform should:

1. capture user explanation
2. transcribe speech
3. extract architecture components
4. generate a system architecture diagram

Architecture diagrams are rendered in the frontend using React Flow.

Example architecture:

Client
→ Load Balancer
→ API Gateway
→ Microservices
→ Database

---

### 5. Voice Explanation Evaluation

Users explain their coding approach using voice input.

Pipeline:

Audio Input
→ Speech-to-Text
→ AI Evaluation
→ Feedback

Speech recognition may use models like OpenAI Whisper.

---

### 6. Retrieval-Augmented Generation (RAG)

InterviewForge uses RAG to generate realistic interview questions.

Knowledge sources include:

* engineering blogs
* system design documentation
* interview experience posts
* distributed systems references

The RAG pipeline:

Documents
→ Chunking
→ Embedding Generation
→ Vector Storage
→ Retrieval
→ LLM Response

Embeddings are stored in Chroma.

The system retrieves relevant context before generating interview questions.

---

### 7. Company-Specific Interview Simulation

InterviewForge can simulate interview patterns of major tech companies such as:

* Amazon
* Google
* Meta

Each company may emphasize different topics such as:

Amazon → leadership principles and scalable systems
Google → algorithms and data structures
Meta → practical coding and performance optimization

---

## System Architecture

The system follows a microservice architecture.

Frontend (Web Application)
→ Next.js + React + TailwindCSS

Main Backend
→ Node.js + Express

AI Backend
→ Python + FastAPI

Databases
→ PostgreSQL (main data)
→ Chroma (vector database)

LLM Runtime
→ Gemini 3.1 Flash Lite (primary) / GPT-4o-mini (fallback via cloud APIs)
   (model names are configurable; see GEMINI_MODEL / OPENAI_MODEL)

Containerization
→ Docker + docker-compose

---

## Service Responsibilities

### Node.js Backend

Responsible for:

* authentication
* user management
* interview session management
* coding problem APIs
* assessment orchestration
* communication with AI services

Node.js should not contain machine learning or AI logic.

---

### AI Backend (FastAPI)

Responsible for:

* RAG pipeline
* LLM orchestration
* question generation
* speech analysis
* coding explanation evaluation
* system design analysis
* architecture diagram generation

---

## Development Principles

* Use open-source or free tools whenever possible.
* All services should run inside Docker containers.
* Use a modular microservice architecture.
* Keep AI logic separate from the main backend.
* Use REST APIs for communication between services.
* Write clean, maintainable, and well-documented code.

---

## Project Structure (Current)

InterviewForge/
  backend/       Express API (auth, users, problems, submissions)
  ai-service/    FastAPI (RAG, LLM, speech)
  code-runner/   Node.js service for sandbox code execution
  web/           Next.js frontend
  docker/        Sandbox Dockerfiles (python, c, cpp, java)
  docker-compose.yml at repo root

---

## Conventions & Coding Rules in Use

**Env & Docker**
- One .env per service: `backend/.env`, `ai-service/.env`, `web/.env`, `code-runner/.env`, `.env.postgres` at root.
- No static `environment:` in docker-compose; use `env_file` only.
- Backend runs in Docker; in backend `.env` use hostnames `postgres` and `code-runner` for container networking.

**Database**
- Migrations: `backend/sql_migrations/` (e.g. `001_init.sql`, `002_add_problem_test_cases.sql`).
- Apply: `docker compose exec -T postgres psql -U postgres -d interviewforge -f - < backend/sql_migrations/XXX.sql`

**Seed data**
- Problems: `backend/leetcode_problems.json`. Seed script: `backend/scripts/seed_problems.ts`.
- Run: `docker compose exec backend npx ts-node scripts/seed_problems.ts`

**API**
- Validate UUID path params (e.g. `:id`); return 400 for invalid format, 404 for not found.
- Do not reference DB columns that do not exist unless added via a migration.

**Code-runner**
- Languages: python, c, cpp, java. Sandbox images: `interviewforge-python-sandbox:latest`, `interviewforge-c-sandbox:latest`, `interviewforge-cpp-sandbox:latest`, `interviewforge-java-sandbox:latest`.
- User code runs only in isolated Docker sandboxes.

---

## Long-Term Vision

InterviewForge aims to become a comprehensive AI-driven interview preparation platform that simulates realistic hiring processes used by top technology companies while providing personalized feedback to help users improve.