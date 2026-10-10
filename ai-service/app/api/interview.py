import json
import logging
import re
from typing import Any, Callable, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core import config
from app.interview.company_profiles import get_company_profile, get_difficulty_calibration
from app.interview.orchestrator import (
    build_context_from_hits,
    build_resume_context,
    get_company_style,
    resume_evidence,
    retrieve_resume_context,
    retrieve_with_live_fallback,
)
from app.llm.chains import (
    HINT_LEVELS,
    ResumeGroundedQuestionOutput,
    StructuredFollowupOutput,
    StructuredQuestionOutput,
    agent_step_chain,
    astream_with_fallback,
    challenge_chain,
    challenge_verify_chain,
    hint_chain,
    persona_instructions,
    evaluation_chain,
    followup_chain,
    interview_report_chain,
    invoke_with_fallback,
    question_generation_chain,
    resume_grounded_question_chain,
    structured_evaluation_chain,
    structured_followup_chain,
    structured_question_chain,
)
from app.rag.service import RAGService
from app.resume.store import ResumeStore
from app.api.schemas import (
    AgentTurnResponse,
    ChallengeResponse,
    FollowupStreamEvent,
    HintResponse,
    InterviewReportResponse,
    NextQuestionResponse,
    NextQuestionStreamEvent,
    StructuredEvaluationOutput,
    documented,
)

logger = logging.getLogger(__name__)


class EventStreamResponse(StreamingResponse):
    """A server-sent-event stream. As a `response_class` it also makes the OpenAPI spec
    document the route's 200 under `text/event-stream`."""

    media_type = "text/event-stream"

    # FastAPI reads the documented status from this signature's default.
    def __init__(self, content, status_code: int = 200, **kwargs):
        super().__init__(content, status_code=status_code, **kwargs)
        # No proxy buffering or caching: each event must reach the client when sent.
        self.headers["Cache-Control"] = "no-cache"
        self.headers["X-Accel-Buffering"] = "no"

router = APIRouter(prefix="/api/interview", tags=["interview"])

_rag_service: Optional[RAGService] = None
_resume_store: Optional[ResumeStore] = None


def _get_resume_store() -> Optional[ResumeStore]:
    """None rather than an exception when the store cannot be built.

    Resume grounding is additive: if it is unavailable the interview must still
    run, just without personalisation."""
    global _resume_store
    if _resume_store is None:
        try:
            _resume_store = ResumeStore()
        except Exception as exc:
            import logging

            logging.getLogger(__name__).warning("resume store unavailable: %s", exc)
            return None
    return _resume_store


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


Persona = Literal["neutral", "friendly", "terse", "adversarial"]


class NextQuestionRequest(BaseModel):
    company: str = Field(..., examples=["amazon"])
    stage: str = Field(..., examples=["behavioral"])
    difficulty: str = Field(default="medium", examples=["medium"])
    top_k: Optional[int] = None
    previous_answer: Optional[str] = None
    # Resume grounding is opt-in per request and requires a user id. Defaulting
    # it on would read another user's namespace the moment a caller forgot to
    # pass user_id -- so the two must arrive together or not at all.
    user_id: Optional[str] = None
    resume_grounded: bool = False
    # Scopes the live-fetch limiter's per-session budget. Without it one
    # interview can spend the whole global daily allowance on its own.
    session_id: Optional[str] = None
    # Tone only (D-066); never reaches retrieval.
    persona: Optional[Persona] = None


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
    persona: Optional[Persona] = None


class HintRequest(BaseModel):
    company: str = Field(..., examples=["google"])
    stage: str = Field(..., examples=["coding"])
    question: str
    context: Optional[str] = ""
    level: int = Field(..., ge=1, le=3)
    previous_hints: List[str] = []
    draft: Optional[str] = None
    persona: Optional[Persona] = None


AgentAction = Literal["probe", "pivot", "advance", "finish"]


class TranscriptTurn(BaseModel):
    role: str
    content: str


class AgentTurnRequest(BaseModel):
    company: str = Field(..., examples=["google"])
    stage: str = Field(..., examples=["coding"])
    stage_position: str = Field(..., examples=["2 of 4"])
    allowed_actions: List[AgentAction] = Field(..., min_length=1)
    questions_left: int = Field(..., ge=0)
    question: str
    answer: str
    evaluation: Dict[str, Any]
    stage_transcript: List[TranscriptTurn] = []
    persona: Optional[Persona] = None


class ChallengeRequest(BaseModel):
    company: str = Field(..., examples=["amazon"])
    stage: str = Field(..., examples=["system_design"])
    question: str
    answer: str
    context: str
    persona: Optional[Persona] = None


class GenerateReportRequest(BaseModel):
    company: str = Field(..., examples=["google"])
    conversation: str = Field(..., description="Full interview conversation text.")


def _safe_company_style(company: str) -> str:
    return get_company_style(company)


def _llm_error(exc: Exception) -> HTTPException:
    text = str(exc)
    lowered = text.lower()

    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        return HTTPException(status_code=429, detail=f"LLM rate limited: {text}")

    return HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


def _raise_llm_http_error(exc: Exception) -> None:
    raise _llm_error(exc)


def _sse(event: dict) -> bytes:
    """One server-sent event. The `event:` field repeats `type`, so a client can use
    either an EventSource-style listener or the JSON discriminator."""
    return f"event: {event['type']}\ndata: {json.dumps(event)}\n\n".encode()


async def _stream_question(chain, payload: dict, output_model, finalize: Callable[[dict], dict]):
    """Run a question chain as a stream of `delta` events closed by `done` or `error`.

    The first partial output is awaited *before* the response starts, so a provider that
    fails up front (and the fallback to the next one) behaves exactly as on the JSON
    endpoint: a real 429/503, not a 200 carrying an error event.

    Only the `question` field streams. The model writes JSON, and LangChain's parser
    yields a growing partial object; each delta is what the question gained since the
    last one. A partial that isn't an extension of what was already sent (possible
    mid-escape) is skipped -- text can't be taken back -- and the `done` copy is
    authoritative.

    Backpressure is end to end: uvicorn's `send` waits while the socket is full, so the
    next partial isn't pulled from the provider until the client reads. On disconnect
    Starlette cancels this generator; the cancellation reaches the provider's stream and
    generation stops (`llm_stream_cancelled` is logged).
    """
    stream = astream_with_fallback(chain, payload).__aiter__()
    try:
        first = await stream.__anext__()
    except StopAsyncIteration:
        raise HTTPException(status_code=503, detail="LLM unavailable: empty response")
    except Exception as exc:
        await stream.aclose()
        _raise_llm_http_error(exc)

    async def events():
        sent = ""
        last = first
        outcome = "cancelled"  # stays so only if the client left mid-stream
        try:
            partial = first
            while True:
                last = partial
                text = partial.get("question") if isinstance(partial, dict) else None
                if isinstance(text, str) and len(text) > len(sent) and text.startswith(sent):
                    yield _sse({"type": "delta", "text": text[len(sent):]})
                    sent = text
                try:
                    partial = await stream.__anext__()
                except StopAsyncIteration:
                    break
            outcome = "finished"
        except Exception as exc:
            outcome = "failed"
            from app.core.observability import current_usage

            error = _llm_error(exc)
            yield _sse({"type": "error", "status": error.status_code, "detail": error.detail, "usage": current_usage()})
            return
        finally:
            if outcome == "cancelled":
                logger.info(json.dumps({"event": "llm_stream_cancelled", "sent_chars": len(sent)}))
            await stream.aclose()

        # Truncated or malformed model output: the JSON endpoint fails to parse it too.
        # Not passed on, because the backend records the question as given.
        try:
            output_model.model_validate(last)
        except Exception as exc:
            from app.core.observability import current_usage

            detail = f"LLM unavailable: incomplete output ({exc.__class__.__name__})"
            yield _sse({"type": "error", "status": 503, "detail": detail, "usage": current_usage()})
            return
        from app.core.observability import current_usage

        # Everything this request spent, retrieval's rerank included; the header can't carry
        # it because it left before generation ran (D-067).
        yield _sse({"type": "done", "result": finalize(last), "usage": current_usage()})

    return EventStreamResponse(events())


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


def _prepare_next_question(req: NextQuestionRequest):
    """Everything before the model call: retrieval, resume grounding, the prompt payload.

    Shared by the JSON and streaming endpoints so the two can't drift. Returns the chain,
    its payload, and the response fields that come from retrieval rather than the model.
    """
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rag = _get_rag_service()
    top_k = req.top_k or config.RAG_TOP_K
    try:
        # The hybrid read-through path, not plain retrieval: when local grounding
        # is weak this fetches, writes back to Chroma and re-retrieves, so the
        # next person asking the same thing gets the fast path. Every failure
        # mode inside it degrades to local context rather than raising.
        retrieved = retrieve_with_live_fallback(
            rag=rag,
            company=req.company,
            stage=req.stage,
            difficulty=req.difficulty,
            top_k=top_k,
            previous_answer=req.previous_answer,
            user_id=req.user_id,
            session_id=req.session_id,
        )
    except Exception as e:
        global _rag_service
        _rag_service = None
        raise HTTPException(status_code=503, detail=f"RAG backend unavailable (Chroma down?): {e}")

    context = build_context_from_hits(retrieved["hits"])
    calibration_text = get_difficulty_calibration(req.company, req.difficulty)

    resume_hits = []
    if req.resume_grounded and req.user_id:
        store = _get_resume_store()
        if store is not None:
            resume_hits = retrieve_resume_context(
                store=store,
                user_id=req.user_id,
                company=req.company,
                stage=req.stage,
            )

    payload = {
        "company": req.company,
        "company_style": _safe_company_style(req.company),
        "stage": req.stage,
        "difficulty": req.difficulty,
        "difficulty_calibration": calibration_text or "Use default expectations for this difficulty.",
        "context": context,
        "persona_instructions": persona_instructions(req.persona),
    }

    # Grounding is decided by whether resume chunks were actually retrieved, not
    # by the request flag. A user who asked for it but has no resume gets the
    # ordinary question rather than a prompt told to cite a resume it cannot see.
    if resume_hits:
        payload["resume_context"] = build_resume_context(resume_hits)
        chain = resume_grounded_question_chain
        output_model = ResumeGroundedQuestionOutput
    else:
        chain = structured_question_chain
        output_model = StructuredQuestionOutput

    extras = {
        "retrievalHits": len(retrieved["hits"]),
        "context": context,
        # Surfaced so the caller can see which path served the question -- a
        # write-back cache whose hit/miss is invisible cannot be verified.
        "retrievalConfidence": retrieved.get("confidence"),
        "liveIngestion": retrieved.get("live"),
        "resumeGrounded": bool(resume_hits),
        "resumeHits": len(resume_hits),
        "resumeEvidence": resume_evidence(resume_hits),
    }
    return chain, payload, output_model, extras


@router.post("/next-question", responses=documented(NextQuestionResponse))
async def next_question(req: NextQuestionRequest):
    chain, payload, _, extras = _prepare_next_question(req)
    try:
        result = await invoke_with_fallback(chain, payload)
    except Exception as exc:
        _raise_llm_http_error(exc)
    return {**result, **extras}


@router.post(
    "/next-question/stream",
    response_class=EventStreamResponse,
    responses=documented(NextQuestionStreamEvent),
)
async def next_question_stream(req: NextQuestionRequest):
    """`/next-question`, with the question's text streamed as it is generated (D-065).

    Bad input, a retrieval outage, or a provider failing before its first token are
    ordinary HTTP errors, exactly as on the JSON endpoint. After that the response is a
    `text/event-stream` of `delta` events and one `done` (the JSON endpoint's body) or
    `error`.
    """
    chain, payload, output_model, extras = _prepare_next_question(req)
    return await _stream_question(chain, payload, output_model, lambda result: {**result, **extras})


@router.post("/evaluate-answer", responses=documented(StructuredEvaluationOutput))
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


def _followup_payload(req: GenerateFollowupRequest) -> dict:
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "company": req.company,
        "company_style": _safe_company_style(req.company),
        "stage": req.stage,
        "question": req.question,
        "answer": req.answer,
        "evaluation": json.dumps(req.evaluation),
        "persona_instructions": persona_instructions(req.persona),
    }


@router.post("/generate-followup", responses=documented(StructuredFollowupOutput))
async def generate_followup(req: GenerateFollowupRequest):
    payload = _followup_payload(req)
    try:
        result = await invoke_with_fallback(structured_followup_chain, payload)
    except Exception as exc:
        _raise_llm_http_error(exc)
    return result


@router.post(
    "/generate-followup/stream",
    response_class=EventStreamResponse,
    responses=documented(FollowupStreamEvent),
)
async def generate_followup_stream(req: GenerateFollowupRequest):
    """`/generate-followup`, streamed; same event contract as `/next-question/stream`."""
    payload = _followup_payload(req)
    return await _stream_question(
        structured_followup_chain, payload, StructuredFollowupOutput, lambda result: result
    )


@router.post("/hint", responses=documented(HintResponse))
async def hint(req: HintRequest):
    """One rung of the hint ladder (D-066). The backend decides whether a hint is allowed
    (time stuck, rungs left) and applies the score penalty; this only writes it."""
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    earlier = "\n".join(f"{i}. {h}" for i, h in enumerate(req.previous_hints, start=1))
    try:
        result = await invoke_with_fallback(hint_chain, {
            "company": req.company,
            "stage": req.stage,
            "question": req.question,
            "level": req.level,
            "level_description": HINT_LEVELS[req.level],
            "previous_hints": earlier or "None.",
            "draft": (req.draft or "").strip() or "Nothing written yet.",
            "context": req.context or "No additional context provided.",
            "persona_instructions": persona_instructions(req.persona),
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    text = result.get("hint") if isinstance(result, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=503, detail="LLM unavailable: empty hint")
    return {"hint": text.strip(), "level": req.level}


_QUOTES = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-"})


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.translate(_QUOTES)).strip().strip(" .,;:!?\"'").lower()


def appears_verbatim(quote: str, source: str) -> bool:
    """`quote` occurs in `source`, ignoring case, whitespace, curly quotes and the
    punctuation a model trims or adds at the ends. Short fragments never count: a
    two-word "quote" matches almost anything."""
    needle = _normalise(quote)
    return len(needle) >= 12 and needle in _normalise(source)


@router.post("/challenge", responses=documented(ChallengeResponse))
async def challenge(req: ChallengeRequest):
    """Grounded challenge (D-066): push back only on a contradiction both sides of which
    can be quoted. The model proposes; this checks the quotes before anything is acted on."""
    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not req.context.strip():
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": "no reference context"}

    try:
        result = await invoke_with_fallback(challenge_chain, {
            "company": req.company,
            "stage": req.stage,
            "question": req.question,
            "answer": req.answer,
            "context": req.context,
            "persona_instructions": persona_instructions(req.persona),
        })
    except Exception as exc:
        _raise_llm_http_error(exc)

    if not isinstance(result, dict) or result.get("contradicts") is not True:
        reason = str(result.get("reason", "")) if isinstance(result, dict) else "unparseable output"
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": reason or "no contradiction"}

    claim, evidence = str(result.get("claim", "")), str(result.get("evidence", ""))
    question = str(result.get("challenge", "")).strip()
    if not appears_verbatim(claim, req.answer):
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": "claim not found in the answer"}
    if not appears_verbatim(evidence, req.context):
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": "evidence not found in the context"}
    if not question:
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": "no challenge question"}

    # Quotes that exist can still be a "different approach", not a contradiction. A second,
    # narrower look at just the two quotes decides; any doubt (or failure) means no pushback.
    try:
        verdict = await invoke_with_fallback(challenge_verify_chain, {"claim": claim, "evidence": evidence})
    except Exception as exc:
        _raise_llm_http_error(exc)
    if not isinstance(verdict, dict) or verdict.get("false_by_evidence") is not True:
        reason = str(verdict.get("reason", "")) if isinstance(verdict, dict) else "unparseable verdict"
        return {"challenged": False, "claim": "", "evidence": "", "question": "", "reason": f"not confirmed: {reason}"}
    return {
        "challenged": True,
        "claim": claim.strip(),
        "evidence": evidence.strip(),
        "question": question,
        "reason": str(result.get("reason", "")),
    }


@router.post("/agent/turn", responses=documented(AgentTurnResponse))
async def agent_turn(req: AgentTurnRequest):
    """The interviewer agent's next move (D-067). The backend says which moves are allowed and
    enforces them again; `fallback` means the agent produced nothing usable and the backend
    should run the fixed flow for this turn. A provider outage is a 429/503 as elsewhere."""
    from app.interview.agent import MAX_SEARCHES, _transcript, run_agent

    try:
        get_company_profile(req.company)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    rag = _get_rag_service()
    payload = {
        "company": req.company,
        "company_style": _safe_company_style(req.company),
        "stage": req.stage,
        "stage_position": req.stage_position,
        "allowed_actions": ", ".join(req.allowed_actions),
        "questions_left": req.questions_left,
        "max_searches": MAX_SEARCHES,
        "question": req.question,
        "answer": req.answer,
        "evaluation": json.dumps(req.evaluation),
        "score": req.evaluation.get("score", "unknown"),
        "stage_transcript": _transcript([t.model_dump() for t in req.stage_transcript]),
        "persona_instructions": persona_instructions(req.persona),
    }
    try:
        return await run_agent(
            rag=rag, invoke=invoke_with_fallback, chain=agent_step_chain, payload=payload,
            allowed=list(req.allowed_actions),
        )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_llm_http_error(exc)


@router.post("/generate-report", responses=documented(InterviewReportResponse))
async def generate_report(req: GenerateReportRequest):
    try:
        result = await invoke_with_fallback(interview_report_chain, {
            "company": req.company,
            "conversation": req.conversation,
        })
    except Exception as exc:
        _raise_llm_http_error(exc)
    return result
