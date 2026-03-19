from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm.chains import invoke_with_fallback, system_design_analysis_chain

router = APIRouter(prefix="/api/system-design", tags=["system-design"])


class SystemDesignAnalysisRequest(BaseModel):
    prompt: str = Field(..., description="System design interview prompt.")
    explanation: str = Field(..., description="Candidate explanation text or transcript.")
    company: Optional[str] = Field(default=None, description="Optional company context.")


def _raise_llm_http_error(exc: Exception) -> None:
    text = str(exc)
    lowered = text.lower()
    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        raise HTTPException(status_code=429, detail=f"LLM rate limited: {text}")
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


@router.post("/analyze")
async def analyze(req: SystemDesignAnalysisRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    if not req.explanation.strip():
        raise HTTPException(status_code=400, detail="explanation is required")

    company_hint = f"Company context: {req.company}" if req.company else "No company context provided."
    try:
        result = await invoke_with_fallback(
            system_design_analysis_chain,
            {
                "prompt": f"{req.prompt}\n\n{company_hint}",
                "explanation": req.explanation,
            },
        )
    except Exception as exc:
        _raise_llm_http_error(exc)

    return result
