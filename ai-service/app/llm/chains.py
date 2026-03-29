import re
import time
from typing import Callable, Dict, List, Optional, TypeVar

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.language_models.chat_models import BaseChatModel
from app.core import config

T = TypeVar("T")
_provider_cooldowns: dict[str, float] = {"gemini": 0.0, "openai": 0.0}

def _has_provider(provider: str) -> bool:
    if provider == "gemini":
        return bool(config.GEMINI_API_KEY)
    if provider == "openai":
        return bool(config.OPENAI_API_KEY)
    return False


def _provider_available_now(provider: str) -> bool:
    return _has_provider(provider) and time.time() >= _provider_cooldowns.get(provider, 0.0)


def _available_providers() -> List[str]:
    configured = [provider for provider in config.LLM_PROVIDER_ORDER if provider in {"openai", "gemini"}]
    preferred = [provider for provider in configured if _provider_available_now(provider)]
    if preferred:
        return preferred
    return [provider for provider in configured if _has_provider(provider)]


def _get_llm(provider: Optional[str] = None) -> BaseChatModel:
    """Return a configured provider, or the first available provider in env order."""
    if provider == "gemini" and config.GEMINI_API_KEY:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=config.GEMINI_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )
    if provider == "openai" and config.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.OPENAI_MODEL,
            api_key=config.OPENAI_API_KEY,
        )
    if provider is None:
        providers = _available_providers()
        if providers:
            return _get_llm(providers[0])
    raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def _should_fallback(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "resourceexhausted" in text
        or "quota" in text
        or "rate limit" in text
        or "429" in text
    )


def _extract_retry_seconds(exc: Exception) -> int:
    match = re.search(r"retry in ([0-9]+)", str(exc).lower())
    if match:
        return int(match.group(1))
    return 60


async def invoke_with_fallback(
    chain_factory: Callable[[Optional[str]], object],
    payload: dict,
) -> T:
    last_error: Optional[Exception] = None
    providers = _available_providers()
    for idx, provider in enumerate(providers):
        try:
            chain = chain_factory(provider)
            return await chain.ainvoke(payload)
        except Exception as exc:
            last_error = exc
            if provider == "gemini" and _should_fallback(exc):
                _provider_cooldowns["gemini"] = time.time() + _extract_retry_seconds(exc)
            if not _should_fallback(exc) or idx == len(providers) - 1:
                raise
    if last_error:
        raise last_error
    raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def question_generation_chain(provider: Optional[str] = None):
    """
    Inputs: context, topic, difficulty
    Output: a single interview question string
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer at a top tech company. "
            "Generate exactly ONE interview question based on the context, topic, and difficulty provided. "
            "The question should be specific, thought-provoking, and test real understanding. "
            "Do not include the answer. Return only the question text."
        )),
        ("human", (
            "## Retrieved context\n{context}\n\n"
            "## Topic\n{topic}\n\n"
            "## Difficulty\n{difficulty}"
        )),
    ])
    return prompt | _get_llm(provider) | StrOutputParser()


def evaluation_chain(provider: Optional[str] = None):
    """
    Inputs: question, answer, context
    Output: structured evaluation (markdown with score, strengths, weaknesses, suggestions)
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer evaluating a candidate's answer. "
            "Evaluate the answer against the question and any available context. "
            "Respond in this exact format:\n\n"
            "## Score\n<number 1-10>/10\n\n"
            "## Strengths\n- <bullet points>\n\n"
            "## Weaknesses\n- <bullet points>\n\n"
            "## Suggestions\n- <bullet points for improvement>\n\n"
            "Be constructive but honest. Evaluate technical correctness, completeness, and communication clarity."
        )),
        ("human", (
            "## Question\n{question}\n\n"
            "## Candidate's Answer\n{answer}\n\n"
            "## Reference Context\n{context}"
        )),
    ])
    return prompt | _get_llm(provider) | StrOutputParser()


def followup_chain(provider: Optional[str] = None):
    """
    Inputs: question, answer, evaluation
    Output: a follow-up question string
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer. "
            "Based on the original question, the candidate's answer, and your evaluation, "
            "generate exactly ONE follow-up question that probes deeper into a weak area "
            "or explores a related concept the candidate should know. "
            "The follow-up should feel natural, like a real interviewer drilling down. "
            "Return only the follow-up question text."
        )),
        ("human", (
            "## Original Question\n{question}\n\n"
            "## Candidate's Answer\n{answer}\n\n"
            "## Evaluation\n{evaluation}"
        )),
    ])
    return prompt | _get_llm(provider) | StrOutputParser()


class StructuredQuestionOutput(BaseModel):
    question: str = Field(description="A single interview question for the candidate.")
    reasoningFocus: str = Field(description="What this question is trying to assess.")
    expectedCompetencies: List[str] = Field(description="Key competencies this question targets.")


class StructuredEvaluationOutput(BaseModel):
    score: int = Field(ge=1, le=10, description="Overall score from 1 to 10.")
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    shouldAskFollowup: bool = Field(description="Whether a follow-up question should be asked.")
    followupFocus: str = Field(description="The main concept to probe in a follow-up.")


class StructuredFollowupOutput(BaseModel):
    question: str = Field(description="A single follow-up interview question.")
    focus: str = Field(description="The weak area or concept being probed.")
    reason: str = Field(description="Why this follow-up is appropriate.")


class RubricSectionScore(BaseModel):
    score: int = Field(ge=1, le=10, description="Section score from 1 to 10.")
    notes: str = Field(description="Short rationale for the section score.")


class VoiceRubricOutput(BaseModel):
    overallScore: int = Field(ge=1, le=10, description="Overall score from 1 to 10.")
    technicalCorrectness: RubricSectionScore
    communicationClarity: RubricSectionScore
    completeness: RubricSectionScore
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]


class ArchitectureNode(BaseModel):
    id: str = Field(description="Stable node identifier in snake_case.")
    label: str = Field(description="Human-readable component label.")
    type: str = Field(description="Component type, e.g. client, service, db, queue.")


class ArchitectureEdge(BaseModel):
    source: str = Field(description="Source node id.")
    target: str = Field(description="Target node id.")
    label: str = Field(description="Connection description.")


class SystemDesignAnalysisOutput(BaseModel):
    summary: str = Field(description="Concise architecture summary.")
    nodes: List[ArchitectureNode]
    edges: List[ArchitectureEdge]
    risks: List[str]
    improvements: List[str]
    rubric: Dict[str, RubricSectionScore]


def structured_question_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=StructuredQuestionOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer. "
            "Generate one interview question tailored to the company style, stage, difficulty, and retrieved context. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Company style\n{company_style}\n\n"
            "## Stage\n{stage}\n\n"
            "## Difficulty\n{difficulty}\n\n"
            "## Retrieved context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


def structured_evaluation_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=StructuredEvaluationOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer. "
            "Evaluate the candidate answer according to the company style and stage expectations. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Company style\n{company_style}\n\n"
            "## Stage\n{stage}\n\n"
            "## Question\n{question}\n\n"
            "## Candidate answer\n{answer}\n\n"
            "## Reference context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


def structured_followup_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=StructuredFollowupOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer. "
            "Generate a natural follow-up question based on the answer and evaluation. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Company style\n{company_style}\n\n"
            "## Stage\n{stage}\n\n"
            "## Original question\n{question}\n\n"
            "## Candidate answer\n{answer}\n\n"
            "## Evaluation summary\n{evaluation}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


def voice_explanation_rubric_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=VoiceRubricOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert technical interviewer. "
            "Evaluate the candidate's spoken explanation transcript. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Question\n{question}\n\n"
            "## Candidate Transcript\n{transcript}\n\n"
            "## Optional Context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


class InterviewReportOutput(BaseModel):
    overallScore: int = Field(ge=1, le=10, description="Overall interview score from 1 to 10.")
    stageScores: Dict[str, Dict[str, str]] = Field(
        description="Score and feedback per stage. Keys are stage names, values have 'score' (int) and 'feedback' (string)."
    )
    strengths: List[str] = Field(description="Top strengths demonstrated across the interview.")
    weaknesses: List[str] = Field(description="Key areas needing improvement.")
    recommendations: List[str] = Field(description="Actionable next-step recommendations for the candidate.")


def interview_report_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=InterviewReportOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, a senior technical interviewer writing a comprehensive post-interview report. "
            "Analyze the full interview conversation across all stages and produce a structured evaluation. "
            "Score each stage individually and give an overall score. Be honest, constructive, and specific. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Interview Conversation\n{conversation}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


def system_design_analysis_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=SystemDesignAnalysisOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, a senior system design interviewer. "
            "Extract architecture components and relationships from the candidate explanation. "
            "Always include realistic trade-offs and score sections in the rubric map using these keys: "
            "requirements, scalability, reliability, data_modeling, communication. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Prompt\n{prompt}\n\n"
            "## Candidate Explanation\n{explanation}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser
