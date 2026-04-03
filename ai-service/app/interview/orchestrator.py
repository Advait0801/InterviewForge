from typing import Any, Dict, List, Optional

from app.interview.company_profiles import CompanyProfile, get_company_profile, get_difficulty_calibration
from app.rag.service import RAGService


def build_retrieval_query(
    *,
    company: str,
    stage: str,
    difficulty: str,
    previous_answer: Optional[str] = None,
) -> str:
    profile = get_company_profile(company)
    topic = profile.stage_topics.get(stage, stage)
    calibration = get_difficulty_calibration(company, difficulty)
    query = (
        f"{profile.name} {stage} interview. Topic: {topic}. "
        f"Difficulty: {difficulty}. Focus areas: {', '.join(profile.focus_areas)}."
    )
    if calibration:
        query += f" Calibration: {calibration}"
    if previous_answer:
        query += f" Candidate previously said: {previous_answer}"
    return query


def retrieve_company_context(
    *,
    rag: RAGService,
    company: str,
    stage: str,
    difficulty: str,
    top_k: int,
    previous_answer: Optional[str] = None,
) -> Dict[str, Any]:
    query = build_retrieval_query(
        company=company,
        stage=stage,
        difficulty=difficulty,
        previous_answer=previous_answer,
    )
    where = {
        "$and": [
            {"company": {"$eq": company}},
            {"stage": {"$eq": stage}},
        ]
    }
    retrieved = rag.retrieve(query, top_k=top_k, where=where)
    if retrieved["hits"]:
        return retrieved
    return rag.retrieve(query, top_k=top_k)


def build_context_from_hits(hits: List[Dict[str, Any]]) -> str:
    if not hits:
        return "No specific retrieval context available."
    return "\n\n---\n\n".join([str(hit["text"]) for hit in hits])


def get_company_style(company: str) -> str:
    profile: CompanyProfile = get_company_profile(company)
    return profile.style
