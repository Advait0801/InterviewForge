"""Resume ingestion, retrieval and deletion.

Every route takes an explicit `user_id`. The backend is the only caller (over
the compose network, after `requireAuth`), so this service does not
re-authenticate -- but it does refuse to act without a user id, because the one
thing that must never happen here is an unscoped operation on personal data.
"""
from __future__ import annotations

import base64
import binascii
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.resume.parser import ResumeParseError, parse_resume_pdf
from app.resume.store import ResumeStore

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["resume"])

_store: Optional[ResumeStore] = None

# Parse failures the user can act on (wrong file, scanned, encrypted) are 422 --
# the request was well-formed, the document was not usable. 500 would be wrong
# and would also hide the actionable message.
_UNPROCESSABLE = {
    "empty_file", "not_a_pdf", "corrupt_pdf", "encrypted_pdf",
    "no_text_layer", "too_large", "too_many_pages",
}


def _get_store() -> ResumeStore:
    global _store
    if _store is None:
        try:
            _store = ResumeStore()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Resume store unavailable: {e}")
    return _store


class IngestResumeRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    resume_id: str = Field(..., min_length=1)
    content_base64: str = Field(..., min_length=1)
    filename: Optional[str] = None


class RetrieveResumeRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    company: str = Field(default="amazon")
    stage: str = Field(default="behavioral")
    top_k: int = Field(default=4, ge=1, le=20)


@router.post("/ingest")
def ingest_resume(req: IngestResumeRequest):
    try:
        data = base64.b64decode(req.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="content_base64 is not valid base64.")

    try:
        parsed = parse_resume_pdf(data)
    except ResumeParseError as exc:
        status = 422 if exc.code in _UNPROCESSABLE else 400
        raise HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})

    store = _get_store()
    try:
        stats = store.ingest(
            req.user_id,
            resume_id=req.resume_id,
            text=parsed.text,
            sections=parsed.sections,
        )
    except Exception as exc:
        # Deliberately NOT purging here. `ResumeStore.ingest` embeds before it
        # touches the namespace, so a failure at the step that actually fails
        # (the embedding provider) leaves the user's previous resume intact --
        # and purging on the way out would be what destroyed it.
        global _store
        _store = None
        raise HTTPException(status_code=503, detail=f"Resume indexing failed: {exc}")

    if stats.chunk_count == 0:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "no_content",
                "message": "The resume parsed but produced no indexable content.",
            },
        )

    return {
        **stats.as_dict(),
        "pageCount": parsed.page_count,
        "charCount": parsed.char_count,
        "parsedSections": sorted(parsed.sections.keys()),
        "filename": req.filename,
    }


@router.post("/retrieve")
def retrieve_resume(req: RetrieveResumeRequest):
    from app.interview.orchestrator import resume_evidence, retrieve_resume_context

    hits = retrieve_resume_context(
        store=_get_store(),
        user_id=req.user_id,
        company=req.company,
        stage=req.stage,
        top_k=req.top_k,
    )
    return {"userId": req.user_id, "hits": len(hits), "evidence": resume_evidence(hits)}


@router.get("/{user_id}/stats")
def resume_stats(user_id: str):
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")
    return _get_store().stats(user_id).as_dict()


@router.delete("/{user_id}")
def delete_resume(user_id: str):
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")
    store = _get_store()
    result = store.purge(user_id)
    # Verify by reading back rather than trusting the delete call -- "deleted"
    # is a claim until a query proves the vectors are gone.
    remaining = store.stats(user_id).chunk_count
    if remaining:
        raise HTTPException(
            status_code=500,
            detail=f"Resume deletion incomplete: {remaining} chunks remain.",
        )
    return {**result, "remainingChunks": 0, "verified": True}
