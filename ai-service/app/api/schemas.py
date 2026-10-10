"""
Response models for the endpoints the Express backend calls.

They are wired with `responses={200: {"model": ...}}`, not `response_model`, so they
document the contract in the OpenAPI spec without filtering or re-validating what the
handler returns: chain output passes through exactly as before. The backend generates its
TypeScript types from the committed spec (`ai-service/openapi.json`), so a change here that
breaks Express fails the backend's typecheck (D-062).
"""
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, RootModel
from typing_extensions import Annotated

from app.llm.chains import (
    CodeReviewOutput,
    RecommendationOutput,
    StructuredEvaluationOutput,
    StructuredFollowupOutput,
    SystemDesignAnalysisOutput,
    VoiceRubricOutput,
)


class RetrievalConfidence(BaseModel):
    confident: bool
    reason: str
    top_distance: Optional[float]
    good_hits: int
    company_matched: bool


class LiveIngestionSkip(BaseModel):
    url: str
    why: str


class LiveIngestion(BaseModel):
    """`triggered` and `reason` always; the rest only once a live fetch was attempted."""

    triggered: bool
    reason: str
    urls_considered: Optional[List[str]] = None
    pages_ingested: Optional[int] = None
    chunks_written: Optional[int] = None
    skipped: Optional[List[LiveIngestionSkip]] = None
    error: Optional[str] = None


class ResumeEvidence(BaseModel):
    section: str
    excerpt: str
    distance: Optional[float]


class NextQuestionResponse(BaseModel):
    question: str
    reasoningFocus: str
    expectedCompetencies: List[str]
    groundedIn: Optional[str] = None
    retrievalHits: int
    context: str
    retrievalConfidence: Optional[RetrievalConfidence]
    liveIngestion: Optional[LiveIngestion]
    resumeGrounded: bool
    resumeHits: int
    resumeEvidence: List[ResumeEvidence]


class ReportStageScore(BaseModel):
    # The chain's parser model says str; models return a number. Both occur.
    score: Union[int, str]
    feedback: str


class InterviewReportResponse(BaseModel):
    overallScore: int
    stageScores: Dict[str, ReportStageScore]
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]


class TranscriptResponse(BaseModel):
    transcript: str


class VoiceEvaluationResponse(BaseModel):
    transcript: str
    evaluation: VoiceRubricOutput


class ResumeIngestResponse(BaseModel):
    userId: str
    namespace: str
    chunkCount: int
    sections: List[str]
    pageCount: int
    charCount: int
    parsedSections: List[str]
    filename: str


class ResumePurgeResponse(BaseModel):
    namespace: str
    deletedChunks: int
    namespaceDropped: bool
    remainingChunks: int
    verified: bool


class AgentTraceStep(BaseModel):
    tool: str
    query: Optional[str] = None
    hits: Optional[int] = None
    action: Optional[str] = None
    automatic: Optional[bool] = None


class AgentTurnResponse(BaseModel):
    """`action` is one of the allowed moves, or `fallback` (the fixed flow should run)."""

    action: Literal["probe", "pivot", "advance", "finish", "fallback"]
    question: str
    focus: str
    rationale: str
    thought: str
    fallback: bool
    context: str
    trace: List[AgentTraceStep]
    steps: int
    proposed: Optional[str] = None


class HintResponse(BaseModel):
    hint: str
    level: int


class ChallengeResponse(BaseModel):
    """`challenged` is true only when both quotes were found verbatim (D-066)."""

    challenged: bool
    claim: str
    evidence: str
    question: str
    reason: str


class StreamDelta(BaseModel):
    """More of the question's text, in order. Concatenated, the deltas are a prefix of
    the final `question`; the `done` event's copy is authoritative."""

    type: Literal["delta"]
    text: str


class StreamError(BaseModel):
    """Generation failed after the stream opened. `status` is what the JSON endpoint
    would have returned (429 rate limited, 503 otherwise)."""

    type: Literal["error"]
    status: int
    detail: str
    usage: Optional["LLMUsage"] = None


class LLMUsage(BaseModel):
    """Model calls made while serving one request (D-067). Estimated cost, not billing."""

    calls: int
    costUsd: float


StreamError.model_rebuild()


class NextQuestionStreamDone(BaseModel):
    type: Literal["done"]
    result: NextQuestionResponse
    usage: LLMUsage


class FollowupStreamDone(BaseModel):
    type: Literal["done"]
    result: StructuredFollowupOutput
    usage: LLMUsage


class NextQuestionStreamEvent(RootModel):
    """The `data` of one `text/event-stream` event; the SSE `event:` field repeats `type`."""

    root: Annotated[Union[StreamDelta, NextQuestionStreamDone, StreamError], Field(discriminator="type")]


class FollowupStreamEvent(RootModel):
    """The `data` of one `text/event-stream` event; the SSE `event:` field repeats `type`."""

    root: Annotated[Union[StreamDelta, FollowupStreamDone, StreamError], Field(discriminator="type")]


def documented(model: type[BaseModel]) -> Dict[int, Dict[str, type[BaseModel]]]:
    """`responses=` value documenting a 200 body without enforcing it."""
    return {200: {"model": model}}


__all__ = [
    "AgentTurnResponse",
    "ChallengeResponse",
    "CodeReviewOutput",
    "FollowupStreamDone",
    "FollowupStreamEvent",
    "HintResponse",
    "InterviewReportResponse",
    "LiveIngestion",
    "LLMUsage",
    "NextQuestionResponse",
    "NextQuestionStreamDone",
    "NextQuestionStreamEvent",
    "RecommendationOutput",
    "ResumeIngestResponse",
    "ResumePurgeResponse",
    "RetrievalConfidence",
    "StreamDelta",
    "StreamError",
    "StructuredEvaluationOutput",
    "StructuredFollowupOutput",
    "SystemDesignAnalysisOutput",
    "TranscriptResponse",
    "VoiceEvaluationResponse",
    "documented",
]
