import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import config
from app.interview.company_profiles import get_company_profile, get_difficulty_calibration
from app.interview.orchestrator import (
    build_context_from_hits,
    get_company_style,
    retrieve_company_context,
)
from app.llm.chains import (
    evaluation_chain,
    followup_chain,
    interview_report_chain,
    invoke_with_fallback,
    question_generation_chain,
    structured_evaluation_chain,
    structured_followup_chain,
    structured_question_chain,
)
from app.rag.service import RAGService

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


class NextQuestionRequest(BaseModel):
    company: str = Field(..., examples=["amazon"])
    stage: str = Field(..., examples=["behavioral"])
    difficulty: str = Field(default="medium", examples=["medium"])
    top_k: Optional[int] = None
    previous_answer: Optional[str] = None


class EvaluateAnswerRequest(BaseModel):
    company: str = Field(..., examples=["google"])
    stage: str = Field(..., examples=["coding"])
    question: str
    answer: str
    context: Optional[str] = ""


class GenerateFollowupRequest(BaseModel):
    company: str = Field(..., examples=["meta"])
    stage: str = Field(..., examples=["system_design"])
    question: str
    answer: str
    evaluation: Dict[str, Any]


class GenerateReportRequest(BaseModel):
    company: str = Field(..., examples=["google"])
    conversation: str = Field(..., description="Full interview conversation text.")


def _safe_company_style(company: str) -> str:
    return get_company_style(company)


def _raise_llm_http_error(exc: Exception) -> None:
    text = str(exc)
    lowered = text.lower()

    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        raise HTTPException(status_code=429, detail=f"LLM rate limited: {text}")

    raise HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


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
    context = build_context_from_hits(retrieved["hits"])

    try:
        result = await invoke_with_fallback(question_generation_chain, {
            "context": context,
            "topic": req.topic,
            "difficulty": req.difficulty,
        })
    except Exception as exc:
        _raise_llm_http_error(exc)

    return {
        "question": result,
        "topic": req.topic,
        "difficulty": req.difficulty,
        "retrieval_hits": len(retrieved["hits"]),
    }


@router.post("/evaluate")
async def evaluate(req: EvaluateRequest):
    try:
        result = await invoke_with_fallback(evaluation_chain, {
            "question": req.question,
            "answer": req.answer,
            "context": req.context or "No additional context provided.",
        })
    except Exception as exc:
        _raise_llm_http_error(exc)

    return {
        "evaluation": result,
        "question": req.question,
    }


@router.post("/followup")
async def followup(req: FollowUpRequest):
    try:
        result = await invoke_with_fallback(followup_chain, {
            "question": req.question,
            "answer": req.answer,
            "evaluation": req.evaluation,
        })
    except Exception as exc:
        _raise_llm_http_error(exc)

    return {
        "followup_question": result,
        "original_question": req.question,
    }


@router.post("/next-question")
async def next_question(req: NextQuestionRequest):
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rag = _get_rag_service()
    top_k = req.top_k or config.RAG_TOP_K
    try:
        retrieved = retrieve_company_context(
            rag=rag,
            company=req.company,
            stage=req.stage,
            difficulty=req.difficulty,
            top_k=top_k,
            previous_answer=req.previous_answer,
        )
    except Exception as e:
        global _rag_service
        _rag_service = None
        raise HTTPException(status_code=503, detail=f"RAG backend unavailable (Chroma down?): {e}")

    context = build_context_from_hits(retrieved["hits"])
    calibration_text = get_difficulty_calibration(req.company, req.difficulty)
    try:
        result = await invoke_with_fallback(structured_question_chain, {
            "company": req.company,
            "company_style": _safe_company_style(req.company),
            "stage": req.stage,
            "difficulty": req.difficulty,
            "difficulty_calibration": calibration_text or "Use default expectations for this difficulty.",
            "context": context,
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    return {
        **result,
        "retrievalHits": len(retrieved["hits"]),
        "context": context,
    }


@router.post("/evaluate-answer")
async def evaluate_answer(req: EvaluateAnswerRequest):
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = await invoke_with_fallback(structured_evaluation_chain, {
            "company": req.company,
            "company_style": _safe_company_style(req.company),
            "stage": req.stage,
            "question": req.question,
            "answer": req.answer,
            "context": req.context or "No additional context provided.",
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    return result


@router.post("/generate-followup")
async def generate_followup(req: GenerateFollowupRequest):
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = await invoke_with_fallback(structured_followup_chain, {
            "company": req.company,
            "company_style": _safe_company_style(req.company),
            "stage": req.stage,
            "question": req.question,
            "answer": req.answer,
            "evaluation": json.dumps(req.evaluation),
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    return result


@router.post("/generate-report")
async def generate_report(req: GenerateReportRequest):
    try:
        result = await invoke_with_fallback(interview_report_chain, {
            "company": req.company,
            "conversation": req.conversation,
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    return result
