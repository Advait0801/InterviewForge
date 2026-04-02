from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm.chains import code_review_chain, invoke_with_fallback

router = APIRouter(prefix="/api/code-review", tags=["code-review"])


class CodeReviewRequest(BaseModel):
    code: str = Field(..., description="Source code to review.")
    language: str = Field(..., description="Language identifier (e.g. python3, cpp).")
    problem_title: str = Field(..., description="Problem title.")
    problem_description: str = Field(..., description="Problem statement.")
    problem_difficulty: str = Field(default="medium", description="easy, medium, or hard.")


def _raise_llm_http_error(exc: Exception) -> None:
    text = str(exc)
    lowered = text.lower()
    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        raise HTTPException(status_code=429, detail=f"LLM rate limited: {text}")
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


@router.post("/review")
async def review_code(req: CodeReviewRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="code is required")
    if not req.problem_title.strip():
        raise HTTPException(status_code=400, detail="problem_title is required")

    try:
        result = await invoke_with_fallback(
            code_review_chain,
            {
                "code": req.code.strip(),
                "language": req.language,
                "problem_title": req.problem_title.strip(),
                "problem_description": req.problem_description.strip() or "(no description)",
                "problem_difficulty": req.problem_difficulty,
            },
        )
    except Exception as exc:
        _raise_llm_http_error(exc)

    return result
