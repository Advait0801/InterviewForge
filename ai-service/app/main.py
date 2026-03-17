from fastapi import FastAPI
from datetime import datetime, timezone
from dotenv import load_dotenv
from app.api.rag import router as rag_router

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