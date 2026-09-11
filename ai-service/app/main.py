from fastapi import FastAPI, Request
from datetime import datetime, timezone
from dotenv import load_dotenv
from app.api.rag import router as rag_router
from app.api.interview import router as interview_router
from app.api.speech import router as speech_router
from app.api.system_design import router as system_design_router
from app.api.code_review import router as code_review_router
from app.api.recommendations import router as recommendations_router
from app.api.resume import router as resume_router

load_dotenv()

app = FastAPI(title="InterviewForge AI Service", version="1.0.0")


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    """Adopt the backend's request id so logs from both services can be joined."""
    from app.core.observability import (
        CORRELATION_HEADER,
        set_correlation_id,
    )

    incoming = request.headers.get(CORRELATION_HEADER)
    set_correlation_id(incoming)
    response = await call_next(request)
    if incoming:
        response.headers[CORRELATION_HEADER] = incoming
    return response


@app.get("/metrics/llm")
def llm_metrics():
    """Token, latency and estimated-cost totals for this process.

    In-memory by design: a restart resets them, and a multi-instance deployment
    would need a real metrics backend. Enough to answer "what does one interview
    cost" without adding infrastructure.
    """
    from app.core.observability import snapshot
    from app.resume import store as resume_store

    # Surfaced here rather than in a separate endpoint so a resume isolation
    # failure shows up on the dashboard that is already being watched. Must
    # be 0; anything else is a data-leak incident, not a metric.
    return {**snapshot(), "resumeIsolationViolations": resume_store.ISOLATION_VIOLATIONS}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/")
def root():
    return {"message": "InterviewForge AI Service"}


app.include_router(rag_router)
app.include_router(interview_router)
app.include_router(speech_router)
app.include_router(system_design_router)
app.include_router(code_review_router)
app.include_router(recommendations_router)
app.include_router(resume_router)
