from fastapi import FastAPI
from datetime import datetime, timezone
from dotenv import load_dotenv
from app.api.rag import router as rag_router
from app.api.interview import router as interview_router
from app.api.speech import router as speech_router
from app.api.system_design import router as system_design_router
from app.api.code_review import router as code_review_router
from app.api.recommendations import router as recommendations_router

load_dotenv()

app = FastAPI(title="InterviewForge AI Service", version="1.0.0")


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