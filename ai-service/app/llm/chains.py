import re
import time
from typing import AsyncIterator, Callable, Dict, List, Optional, TypeVar

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


def _model_for(provider: str) -> str:
    return config.GEMINI_MODEL if provider == "gemini" else config.OPENAI_MODEL


def _estimate_tokens(payload: dict, result: object) -> tuple[int, int]:
    """Rough token counts from character length.

    LangChain does not surface usage metadata uniformly across providers, and
    adding a tokeniser per provider is not worth it for a cost estimate. ~4
    characters per token is the usual approximation; this is used for
    order-of-magnitude cost reporting, not billing.
    """
    inp = sum(len(str(v)) for v in payload.values()) // 4
    out = len(str(result)) // 4
    return inp, out


async def invoke_with_fallback(
    chain_factory: Callable[[Optional[str]], object],
    payload: dict,
    *,
    chain_name: Optional[str] = None,
) -> T:
    """Invoke a chain, failing over between providers, with cost/latency recorded.

    `chain_name` defaults to the factory's own name, so every existing call site
    gets per-chain metrics without being touched -- and a new chain is labelled
    correctly by default rather than landing in an "unknown" bucket.
    """
    from app.core.observability import timed

    label = chain_name or getattr(chain_factory, "__name__", "unknown")
    last_error: Optional[Exception] = None
    providers = _available_providers()
    for idx, provider in enumerate(providers):
        try:
            chain = chain_factory(provider)
            with timed(label, provider, _model_for(provider)) as call:
                result = await chain.ainvoke(payload)
                call.input_tokens, call.output_tokens = _estimate_tokens(payload, result)
            return result
        except Exception as exc:
            last_error = exc
            if provider == "gemini" and _should_fallback(exc):
                _provider_cooldowns["gemini"] = time.time() + _extract_retry_seconds(exc)
            if not _should_fallback(exc) or idx == len(providers) - 1:
                raise
    if last_error:
        raise last_error
    raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


async def astream_with_fallback(
    chain_factory: Callable[[Optional[str]], object],
    payload: dict,
    *,
    chain_name: Optional[str] = None,
) -> AsyncIterator[object]:
    """`invoke_with_fallback`, streamed: yields the chain's growing partial output.

    A provider can only be swapped before anything has been yielded; once the caller has
    shown text from one model, switching to another would splice two different answers
    together, so a later failure is raised as-is. Closing the generator early (a client
    disconnect) propagates into the provider's stream and stops generation; the call is
    recorded with what was produced so far, so cancelled streams still show up in cost.
    """
    from app.core.observability import timed

    label = chain_name or getattr(chain_factory, "__name__", "unknown")
    providers = _available_providers()
    if not providers:
        raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")
    for idx, provider in enumerate(providers):
        yielded = False
        try:
            chain = chain_factory(provider)
            with timed(label, provider, _model_for(provider)) as call:
                last: object = None
                try:
                    async for partial in chain.astream(payload):
                        last = partial
                        yielded = True
                        yield partial
                finally:
                    call.input_tokens, call.output_tokens = _estimate_tokens(payload, last or "")
            return
        except Exception as exc:
            if yielded:
                raise
            if provider == "gemini" and _should_fallback(exc):
                _provider_cooldowns["gemini"] = time.time() + _extract_retry_seconds(exc)
            if not _should_fallback(exc) or idx == len(providers) - 1:
                raise


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


class ResumeGroundedQuestionOutput(BaseModel):
    question: str = Field(description="A single interview question for the candidate.")
    reasoningFocus: str = Field(description="What this question is trying to assess.")
    expectedCompetencies: List[str] = Field(description="Key competencies this question targets.")
    groundedIn: str = Field(
        description=(
            "The exact detail from the candidate's resume this question refers to -- "
            "a project name, employer, or technology copied verbatim from the resume "
            "context. Empty string only if the resume context was unusable."
        )
    )


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


# Interviewer personas (D-066). Tone only: the technical bar, retrieval and grading are the
# same for every persona, so evaluation and report chains never receive one.
PERSONAS: Dict[str, str] = {
    "friendly": (
        "Persona: friendly. Open with one short, warm sentence before the question (for example, "
        "acknowledging the candidate or saying what you're curious about), use plain conversational "
        "phrasing, and frame it as a discussion. Keep the technical bar exactly the same."
    ),
    "terse": (
        "Persona: terse. Write at most two sentences and under 30 words in total. No greeting, no "
        "scenario set-up (no \"Imagine\" or \"Suppose\"), no preamble: state the task directly. Keep the "
        "technical bar exactly the same."
    ),
    "adversarial": (
        "Persona: adversarial, a skeptical bar-raiser. Open by challenging an assumption or a common "
        "answer (for example, \"Most candidates reach for X here. Why would that fail?\"), then demand "
        "justification: ask the candidate to defend trade-offs and say what breaks. Sound skeptical, "
        "never encouraging; stay professional, never rude or personal. Keep the technical bar exactly "
        "the same."
    ),
}
PERSONA_NAMES = ("neutral", *PERSONAS)


def persona_instructions(persona: Optional[str]) -> str:
    """The `persona_instructions` value for a prompt: placed at the start of its system
    message. Empty for neutral (or none), which renders the prompt exactly as it was before
    personas existed, so the measured baseline holds.

    At the start, not the end: after the long JSON format block the model all but ignored it
    (D-066). And not a second system message: Gemini's client rejects any system message
    that isn't the first (found by the live eval; the fake model accepts it)."""
    if not persona or persona == "neutral":
        return ""
    return PERSONAS[persona] + "\n\n"


def structured_question_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=StructuredQuestionOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "{persona_instructions}You are InterviewForge, an expert technical interviewer. "
            "Generate one interview question tailored to the company style, stage, difficulty, and retrieved context. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Company style\n{company_style}\n\n"
            "## Stage\n{stage}\n\n"
            "## Difficulty\n{difficulty}\n\n"
            "## Difficulty calibration (bar for this level)\n{difficulty_calibration}\n\n"
            "## Retrieved context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions(), persona_instructions="")
    return prompt | _get_llm(provider) | parser


def resume_grounded_question_chain(provider: Optional[str] = None):
    """Question generation that blends company context with the candidate's resume.

    A separate chain rather than an extra variable on `structured_question_chain`
    on purpose: that chain is covered by the Phase 1 prompt-regression snapshots
    and is the one the retrieval evaluation measures. Editing its prompt would
    invalidate both for a feature that only some sessions use.

    The prompt keeps the two context blocks *labelled and separate*. Merged into
    one blob, the model reliably confuses "what this company asks about" with
    "what this candidate did", and starts attributing the company's engineering
    blog to the candidate.
    """
    parser = JsonOutputParser(pydantic_object=ResumeGroundedQuestionOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "{persona_instructions}You are InterviewForge, an expert technical interviewer. "
            "Generate one interview question that is specific to THIS candidate, "
            "asked in the style of the target company.\n"
            "Rules:\n"
            "- The question MUST refer to something concrete from the candidate resume "
            "context: a named project, employer, or technology they actually listed.\n"
            "- Never invent experience the resume does not contain. If the resume is thin "
            "on this stage, ask about the closest thing it does contain.\n"
            "- The company context describes what the company cares about. It is NOT the "
            "candidate's experience -- never attribute it to them.\n"
            "- Set groundedIn to the resume detail you used, copied verbatim.\n"
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Company style\n{company_style}\n\n"
            "## Stage\n{stage}\n\n"
            "## Difficulty\n{difficulty}\n\n"
            "## Difficulty calibration (bar for this level)\n{difficulty_calibration}\n\n"
            "## Company context (what this company probes for -- NOT the candidate)\n{context}\n\n"
            "## Candidate resume context (the candidate's own experience)\n{resume_context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions(), persona_instructions="")
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
            "{persona_instructions}You are InterviewForge, an expert technical interviewer. "
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
    ]).partial(format_instructions=parser.get_format_instructions(), persona_instructions="")
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


class HintOutput(BaseModel):
    hint: str = Field(description="The hint, addressed to the candidate, in one to three sentences.")


# What each rung of the hint ladder may reveal (D-066). The judge in app.eval.interviewer
# checks that the rungs reveal progressively more and that the first two never give the
# answer away.
HINT_LEVELS: Dict[int, str] = {
    1: (
        "a nudge: name the difficulty or bottleneck the question hinges on (what makes the obvious "
        "approach too slow, fragile or wrong), ideally as a question back to the candidate. Do NOT "
        "suggest any solution or direction."
    ),
    2: (
        "a direction: build on the first hint and be clearly more specific than it. Describe the "
        "mechanism a good solution uses in concrete terms (what to store or track, and how it is "
        "used), WITHOUT naming the specific technique, algorithm, data structure, protocol or "
        "pattern. For many questions the name is the answer. Stop short of the step that completes "
        "the answer: if spelling out the mechanism would solve the question outright, describe only "
        "the property it must guarantee and leave the mechanism to the next hint."
    ),
    3: (
        "a near-solution: name the technique and outline its key steps, but leave the details, "
        "edge cases and final assembly to the candidate."
    ),
}


def hint_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=HintOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "{persona_instructions}You are InterviewForge, an expert technical interviewer. The candidate is stuck and "
            "asked for a hint. Give exactly one hint at the requested level.\n"
            "Rules:\n"
            "- Never state the complete answer.\n"
            "- Never repeat an earlier hint; build on it.\n"
            "- Use the reference context when it is relevant, but do not quote it at length.\n"
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Stage\n{stage}\n\n"
            "## Question\n{question}\n\n"
            "## Hint level {level} of 3: {level_description}\n\n"
            "## Earlier hints\n{previous_hints}\n\n"
            "## Candidate's draft so far\n{draft}\n\n"
            "## Reference context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions(), persona_instructions="")
    return prompt | _get_llm(provider) | parser


class ChallengeOutput(BaseModel):
    contradicts: bool = Field(description="True only if the answer states a fact the context directly contradicts.")
    claim: str = Field(description="The contradicted statement, copied verbatim from the answer. Empty if none.")
    evidence: str = Field(description="The contradicting passage, copied verbatim from the context. Empty if none.")
    challenge: str = Field(description="One follow-up question that pushes back, citing the evidence. Empty if none.")
    reason: str = Field(description="One short sentence explaining the decision.")


def challenge_chain(provider: Optional[str] = None):
    """Grounded challenge (D-066): does the answer contradict the retrieved context?

    Pushing back on a correct answer is far worse than missing a wrong one, so the prompt
    asks for direct contradictions only, and the caller verifies both quotes verbatim
    before acting on a `contradicts: true`."""
    parser = JsonOutputParser(pydantic_object=ChallengeOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "{persona_instructions}You are InterviewForge, an expert technical interviewer checking a candidate's answer "
            "against reference material.\n"
            "Decide whether the answer states a specific fact that the reference context DIRECTLY "
            "contradicts.\n"
            "Not a contradiction: something the context does not mention; an omission; a "
            "different but valid approach; opinions, preferences or trade-off judgements; vague "
            "or weak answers.\n"
            "If there is a direct contradiction: copy the contradicted statement from the answer "
            "word for word into claim, copy the contradicting passage from the context word for "
            "word into evidence, and write one follow-up question that politely pushes back, "
            "cites the evidence, and asks the candidate to reconcile the two.\n"
            "If not: contradicts is false and claim, evidence and challenge are empty strings.\n"
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Company\n{company}\n\n"
            "## Stage\n{stage}\n\n"
            "## Question\n{question}\n\n"
            "## Candidate answer\n{answer}\n\n"
            "## Reference context\n{context}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions(), persona_instructions="")
    return prompt | _get_llm(provider) | parser


class ChallengeVerdict(BaseModel):
    false_by_evidence: bool = Field(description="True only if the evidence states or directly implies the claim is false.")
    reason: str = Field(description="One short sentence.")


def challenge_verify_chain(provider: Optional[str] = None):
    """Second look at a suspected contradiction, from the two quotes alone (D-066).

    The first pass sees the whole answer and context and tends to read "a different choice
    from the one the context lists" as a contradiction. This asks a narrower question with
    nothing else to go on: does this passage say this sentence is false?"""
    parser = JsonOutputParser(pydantic_object=ChallengeVerdict)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You check one claim against one passage of reference material.\n"
            "false_by_evidence is true ONLY if the passage states, or directly implies, that the claim is false.\n"
            "It is false when the claim simply picks a different option, tool or approach than one the passage "
            "mentions, adds detail the passage doesn't cover, or is vague.\n"
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", "## Claim\n{claim}\n\n## Passage\n{evidence}"),
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


class CodeReviewOutput(BaseModel):
    timeComplexity: str = Field(description="Big-O time complexity of the solution (e.g. O(n)).")
    spaceComplexity: str = Field(description="Big-O auxiliary space complexity.")
    qualityScore: int = Field(ge=1, le=10, description="Code quality score from 1 to 10.")
    strengths: List[str] = Field(description="What the code does well.")
    issues: List[str] = Field(description="Bugs, style issues, or correctness concerns.")
    optimizations: List[str] = Field(description="Concrete optimization or refactor suggestions.")
    summary: str = Field(description="One short paragraph summarizing the review.")


def code_review_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=CodeReviewOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, an expert coding interview reviewer. "
            "Analyze the candidate's code against the problem statement. "
            "Estimate time and space complexity for their approach (not necessarily optimal). "
            "Be constructive: note strengths, issues, and optimizations. "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Problem title\n{problem_title}\n\n"
            "## Difficulty\n{problem_difficulty}\n\n"
            "## Problem description\n{problem_description}\n\n"
            "## Language\n{language}\n\n"
            "## Code\n```\n{code}\n```"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser


class RecommendationOutput(BaseModel):
    recommendedTopics: List[str] = Field(
        description="2-5 DSA or topic areas the user should prioritize next (e.g. binary search, graphs)."
    )
    reasoning: str = Field(description="Brief explanation of why these topics fit this user.")
    focusAreas: List[str] = Field(description="Specific skills or patterns to drill.")
    difficultySuggestion: str = Field(
        description="Suggested next difficulty band: easy, medium, or hard, with one sentence rationale."
    )


def recommendation_chain(provider: Optional[str] = None):
    parser = JsonOutputParser(pydantic_object=RecommendationOutput)
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are InterviewForge, a technical coach for coding interview preparation. "
            "Given the user's solve history summary, suggest what to study next. "
            "Topics should be concrete (e.g. two pointers, DP, trees). "
            "Return valid JSON only.\n{format_instructions}"
        )),
        ("human", (
            "## Total problems solved\n{total_solved}\n\n"
            "## Difficulty distribution (counts)\n{difficulty_distribution}\n\n"
            "## Topics from solved problems (with counts)\n{topic_counts}\n\n"
            "## Weak topics (low success or many failures)\n{weak_topics}\n\n"
            "## Recent focus (optional)\n{recent_notes}"
        )),
    ]).partial(format_instructions=parser.get_format_instructions())
    return prompt | _get_llm(provider) | parser
