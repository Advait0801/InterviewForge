import logging
import os
from typing import Any, Dict, List, Optional

from app.ingest import confidence as conf
from app.interview.company_profiles import CompanyProfile, get_company_profile, get_difficulty_calibration
from app.rag.service import RAGService

log = logging.getLogger(__name__)

LIVE_FALLBACK_ENABLED = os.getenv("LIVE_FETCH_ENABLED", "true").strip().lower() in ("1", "true", "yes")


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
    retrieved = rag.retrieve(query, top_k=top_k, where=where, stage=stage)
    if not retrieved["hits"]:
        # Nothing matched the company+stage filter; fall back to the whole corpus
        # so the LLM still gets some grounding rather than none.
        retrieved = rag.retrieve(query, top_k=top_k, stage=stage)
    return retrieved


def retrieve_with_live_fallback(
    *,
    rag: RAGService,
    company: str,
    stage: str,
    difficulty: str,
    top_k: int,
    previous_answer: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve locally; if grounding is weak, fetch and write back, then retry.

    This is the read-through cache: the first request for a thinly-covered topic
    pays the fetch, and everything it writes back makes later requests fast.
    Never raises on the live path -- a failed fetch degrades to whatever local
    context exists rather than breaking the interview.
    """
    retrieved = retrieve_company_context(
        rag=rag, company=company, stage=stage, difficulty=difficulty,
        top_k=top_k, previous_answer=previous_answer,
    )
    verdict = conf.assess(retrieved["hits"], company=company)
    retrieved["confidence"] = verdict.as_dict()
    retrieved["live"] = {"triggered": False, "reason": "not attempted"}

    if verdict.confident or not LIVE_FALLBACK_ENABLED:
        if not LIVE_FALLBACK_ENABLED and not verdict.confident:
            retrieved["live"] = {"triggered": False, "reason": "live fallback disabled"}
        return retrieved

    from app.ingest.live import maybe_fetch

    query = build_retrieval_query(
        company=company, stage=stage, difficulty=difficulty, previous_answer=previous_answer
    )
    outcome = maybe_fetch(
        rag, query=query, company=company, stage=stage,
        user_id=user_id, session_id=session_id,
    )
    retrieved["live"] = outcome.as_dict()

    if outcome.chunks_written > 0:
        # Re-retrieve so the freshly written chunks can be used immediately.
        refreshed = retrieve_company_context(
            rag=rag, company=company, stage=stage, difficulty=difficulty,
            top_k=top_k, previous_answer=previous_answer,
        )
        refreshed["confidence"] = conf.assess(refreshed["hits"], company=company).as_dict()
        refreshed["live"] = outcome.as_dict()
        return refreshed

    return retrieved


def build_context_from_hits(hits: List[Dict[str, Any]]) -> str:
    """Build the LLM context string from retrieved hits.

    Prefers `parent_text` when small-to-big expansion produced it: the small
    chunk is what matched, but the wider passage is what actually answers the
    question.
    """
    if not hits:
        return "No specific retrieval context available."
    return "\n\n---\n\n".join(
        str(hit.get("parent_text") or hit["text"]) for hit in hits
    )


def get_company_style(company: str) -> str:
    profile: CompanyProfile = get_company_profile(company)
    return profile.style


# --- resume-grounded retrieval (Phase 5) ------------------------------------

# What to pull out of a resume for each interview stage. A behavioural question
# needs the employment history; a system design question needs the projects.
# Retrieving the whole resume for every stage would hand the model five chunks
# of skills-list boilerplate and bury the one project worth asking about.
RESUME_STAGE_QUERIES: Dict[str, str] = {
    "behavioral": (
        "ownership, leadership, collaboration and impact in the candidate's roles, "
        "employers, responsibilities and outcomes"
    ),
    "coding": (
        "programming languages, algorithms, data structures and implementation work "
        "in the candidate's projects"
    ),
    "system_design": (
        "architecture, scale, infrastructure, databases, distributed systems and "
        "technical design decisions in the candidate's projects"
    ),
    "core_cs": (
        "operating systems, networking, databases, concurrency and computer science "
        "fundamentals in the candidate's coursework, projects and skills"
    ),
}


def build_resume_query(*, company: str, stage: str) -> str:
    focus = RESUME_STAGE_QUERIES.get(stage, "the candidate's experience, projects and skills")
    profile = get_company_profile(company)
    return f"{focus}. Relevant to: {', '.join(profile.focus_areas)}."


def retrieve_resume_context(
    *,
    store: Any,
    user_id: Optional[str],
    company: str,
    stage: str,
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """Fetch the candidate's own resume chunks for this stage.

    Returns [] rather than raising for every failure mode -- no user, no resume,
    Chroma unreachable. A resume is an enhancement to the interview, and losing
    it must degrade to the ordinary company-grounded question rather than fail
    the request.
    """
    if not user_id:
        return []
    try:
        return store.retrieve(
            user_id, build_resume_query(company=company, stage=stage), top_k=top_k
        )
    except Exception as exc:
        log.warning("resume retrieval failed, continuing without it: %s", str(exc)[:200])
        return []


def build_resume_context(hits: List[Dict[str, Any]]) -> str:
    """Render resume hits with their section labels.

    The section name is what lets the model say "your Kafka pipeline project"
    instead of "something in your resume": without it the chunks are unlabelled
    prose and the model has to guess whether it is reading a job or a project.
    """
    if not hits:
        return ""
    blocks = []
    for hit in hits:
        section = (hit.get("metadata") or {}).get("section", "resume")
        blocks.append(f"[{section}]\n{hit.get('text', '')}")
    return "\n\n---\n\n".join(blocks)


def resume_evidence(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compact, non-sensitive provenance for the API response and the UI."""
    return [
        {
            "section": (hit.get("metadata") or {}).get("section", "resume"),
            "excerpt": str(hit.get("text", ""))[:180],
            "distance": hit.get("distance"),
        }
        for hit in hits
    ]
