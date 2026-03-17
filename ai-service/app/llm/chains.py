from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.language_models.chat_models import BaseChatModel
from app.core import config


def _get_llm() -> BaseChatModel:
    """Return the primary LLM (Gemini) or fallback (OpenAI)."""
    if config.GEMINI_API_KEY:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=config.GEMINI_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )
    if config.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.OPENAI_MODEL,
            api_key=config.OPENAI_API_KEY,
        )
    raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")


def question_generation_chain():
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
    return prompt | _get_llm() | StrOutputParser()


def evaluation_chain():
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
    return prompt | _get_llm() | StrOutputParser()


def followup_chain():
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
    return prompt | _get_llm() | StrOutputParser()
