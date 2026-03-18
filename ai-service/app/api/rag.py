from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core import config
from app.rag.service import RAGService
from app.llm.chains import _get_llm, invoke_with_fallback

router = APIRouter(prefix="/api/rag", tags=["rag"])

_rag_service: Optional[RAGService] = None


def _get_rag_service() -> RAGService:
    """
    Lazy-init to avoid crashing the app if Chroma is temporarily unavailable.
    """
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


class IngestDoc(BaseModel):
    source: str = Field(..., examples=["system_design_blog"])
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IngestRequest(BaseModel):
    documents: List[IngestDoc]


class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = None
    answer: bool = True
    where: Optional[Dict[str, Any]] = None


_rag_answer_chain = None


def _get_rag_answer_chain():
    global _rag_answer_chain
    if _rag_answer_chain is None:
        prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are InterviewForge, a technical interviewer. "
                "Use the following retrieved context to answer the user's query. "
                "If the context is insufficient, say what is missing and answer from general knowledge."
            )),
            ("human", "## Retrieved context\n{context}\n\n## User query\n{query}"),
        ])
        _rag_answer_chain = prompt | _get_llm() | StrOutputParser()
    return _rag_answer_chain


@router.post("/ingest")
def ingest(req: IngestRequest):
    rag = _get_rag_service()
    try:
        res = rag.ingest_documents([d.model_dump() for d in req.documents])
        return res
    except Exception as e:
        # Chroma could be temporarily unavailable (restart, network blip, etc.)
        global _rag_service
        _rag_service = None
        raise HTTPException(status_code=503, detail=f"RAG backend unavailable (Chroma down?): {e}")


@router.post("/query")
async def query(req: QueryRequest):
    rag = _get_rag_service()
    top_k = req.top_k or config.RAG_TOP_K
    try:
        retrieved = rag.retrieve(req.query, top_k=top_k, where=req.where)
    except Exception as e:
        global _rag_service
        _rag_service = None
        raise HTTPException(status_code=503, detail=f"RAG backend unavailable (Chroma down?): {e}")

    if not req.answer:
        return {"retrieval": retrieved}

    context = "\n\n---\n\n".join([h["text"] for h in retrieved["hits"]])

    answer = await invoke_with_fallback(
        lambda provider: (
            ChatPromptTemplate.from_messages([
                ("system", (
                    "You are InterviewForge, a technical interviewer. "
                    "Use the following retrieved context to answer the user's query. "
                    "If the context is insufficient, say what is missing and answer from general knowledge."
                )),
                ("human", "## Retrieved context\n{context}\n\n## User query\n{query}"),
            ]) | _get_llm(provider) | StrOutputParser()
        ),
        {"context": context, "query": req.query},
    )

    return {"retrieval": retrieved, "answer": answer}
