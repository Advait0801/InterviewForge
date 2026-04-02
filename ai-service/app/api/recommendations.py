from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm.chains import invoke_with_fallback, recommendation_chain

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


class RecommendRequest(BaseModel):
    total_solved: int = Field(..., ge=0)
    difficulty_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Counts per difficulty for solved problems.",
    )
    topic_counts: Dict[str, int] = Field(
        default_factory=dict,
        description="Topic -> count from solved problems.",
    )
    weak_topics: List[str] = Field(default_factory=list)
    recent_notes: Optional[str] = Field(default=None, description="Optional short summary for the model.")


def _raise_llm_http_error(exc: Exception) -> None:
    text = str(exc)
    lowered = text.lower()
    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        raise HTTPException(status_code=429, detail=f"LLM rate limited: {text}")
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


def _format_distribution(d: Dict[str, Any]) -> str:
    if not d:
        return "(none)"
    return ", ".join(f"{k}: {v}" for k, v in sorted(d.items()))


def _format_topic_counts(d: Dict[str, int]) -> str:
    if not d:
        return "(none)"
    return ", ".join(f"{k}: {v}" for k, v in sorted(d.items(), key=lambda x: -x[1]))


@router.post("/recommend")
async def recommend(req: RecommendRequest):
    try:
        result = await invoke_with_fallback(
            recommendation_chain,
            {
                "total_solved": str(req.total_solved),
                "difficulty_distribution": _format_distribution(req.difficulty_distribution),
                "topic_counts": _format_topic_counts(req.topic_counts),
                "weak_topics": ", ".join(req.weak_topics) if req.weak_topics else "(none)",
                "recent_notes": (req.recent_notes or "").strip() or "(none)",
            },
        )
    except Exception as exc:
        _raise_llm_http_error(exc)

    return result
