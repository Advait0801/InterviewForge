from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.core import config
from app.rag.service import RAGService
from app.llm.service import LLMService

router = APIRouter(prefix="/api/rag", tags=["rag"])

rag = RAGService()
llm = LLMService()

class IngestDoc(BaseModel):
    source: str = Field(..., examples=["system_design_blog"])
    text: str

class IngestRequest(BaseModel):
    documents: List[IngestDoc]

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = None
    answer: bool = True

@router.post("/ingest")
def ingest(req: IngestRequest):
    res = rag.ingest_documents([d.model_dump() for d in req.documents])
    return res

@router.post("/query")
async def query(req: QueryRequest):
    top_k = req.top_k or config.RAG_TOP_K
    retrieved = rag.retrieve(req.query, top_k=top_k)

    if not req.answer:
        return {"retrieval": retrieved}

    provider = llm.available_provider()
    if provider == "none":
        raise HTTPException(status_code=400, detail="No LLM configured for answering. Set GEMINI_API_KEY or OPENAI_API_KEY.")

    context = "\n\n---\n\n".join([h["text"] for h in retrieved["hits"]])
    prompt = f"""You are InterviewForge, a technical interviewer.

Use the following retrieved context to answer the user's query. If the context is insufficient, say what is missing and answer from general knowledge.

## Retrieved context
{context}

## User query
{req.query}
"""

    answer = await llm.generate(prompt)
    return {"retrieval": retrieved, "answer": answer, "provider": provider}