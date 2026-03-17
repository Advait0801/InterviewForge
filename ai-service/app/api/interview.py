from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core import config
from app.rag.service import RAGService
from app.llm.chains import question_generation_chain, evaluation_chain, followup_chain

router = APIRouter(prefix="/api/interview", tags=["interview"])

_rag_service: Optional[RAGService] = None


def _get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        try:
            _rag_service = RAGService()
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"RAG backend unavailable (Chroma down?): {e}",
            )
    return _rag_service


class GenerateQuestionRequest(BaseModel):
    topic: str = Field(..., examples=["system design"])
    difficulty: str = Field(..., examples=["medium"])
    top_k: Optional[int] = None


class EvaluateRequest(BaseModel):
    question: str
    answer: str
    context: Optional[str] = ""


class FollowUpRequest(BaseModel):
    question: str
    answer: str
    evaluation: str


@router.post("/generate-question")
async def generate_question(req: GenerateQuestionRequest):
    rag = _get_rag_service()
    top_k = req.top_k or config.RAG_TOP_K
    try:
        retrieved = rag.retrieve(req.topic, top_k=top_k)
    except Exception as e:
        global _rag_service
        _rag_service = None
        raise HTTPException(status_code=503, detail=f"RAG backend unavailable (Chroma down?): {e}")
    context = "\n\n---\n\n".join([h["text"] for h in retrieved["hits"]])

    chain = question_generation_chain()
    result = await chain.ainvoke({
        "context": context or "No specific context available.",
        "topic": req.topic,
        "difficulty": req.difficulty,
    })

    return {
        "question": result,
        "topic": req.topic,
        "difficulty": req.difficulty,
        "retrieval_hits": len(retrieved["hits"]),
    }


@router.post("/evaluate")
async def evaluate(req: EvaluateRequest):
    chain = evaluation_chain()
    result = await chain.ainvoke({
        "question": req.question,
        "answer": req.answer,
        "context": req.context or "No additional context provided.",
    })

    return {
        "evaluation": result,
        "question": req.question,
    }


@router.post("/followup")
async def followup(req: FollowUpRequest):
    chain = followup_chain()
    result = await chain.ainvoke({
        "question": req.question,
        "answer": req.answer,
        "evaluation": req.evaluation,
    })

    return {
        "followup_question": result,
        "original_question": req.question,
    }
