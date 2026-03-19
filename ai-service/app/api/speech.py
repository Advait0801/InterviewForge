import base64
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import config
from app.llm.chains import invoke_with_fallback, voice_explanation_rubric_chain

router = APIRouter(prefix="/api/speech", tags=["speech"])


class TranscribeRequest(BaseModel):
    audioBase64: str = Field(description="Base64-encoded audio bytes.")
    mimeType: str = Field(default="audio/webm")
    filename: str = Field(default="recording.webm")
    language: Optional[str] = Field(default=None, description="Optional BCP-47 language hint, e.g. en.")


class EvaluateExplanationRequest(TranscribeRequest):
    question: str = Field(..., description="Interview question being answered.")
    context: Optional[str] = Field(default="", description="Optional reference context.")


def _raise_llm_http_error(exc: Exception) -> None:
    text = str(exc)
    lowered = text.lower()
    if "429" in lowered or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
        raise HTTPException(status_code=429, detail=f"LLM rate limited: {text}")
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {text}")


def _decode_audio(audio_b64: str) -> bytes:
    try:
        return base64.b64decode(audio_b64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid audioBase64 payload: {exc}")


def _transcribe_audio(req: TranscribeRequest) -> str:
    if not config.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Speech transcription unavailable: OPENAI_API_KEY not configured.")

    audio_bytes = _decode_audio(req.audioBase64)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audioBase64 decoded to empty payload.")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=config.OPENAI_API_KEY)
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(req.filename, audio_bytes, req.mimeType),
            language=req.language or None,
        )
        text = (response.text or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="Transcription produced empty text.")
        return text
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Speech transcription failed: {exc}")


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    transcript = _transcribe_audio(req)
    return {"transcript": transcript}


@router.post("/evaluate-explanation")
async def evaluate_explanation(req: EvaluateExplanationRequest):
    transcript = _transcribe_audio(req)

    try:
        rubric = await invoke_with_fallback(
            voice_explanation_rubric_chain,
            {
                "question": req.question,
                "transcript": transcript,
                "context": req.context or "No additional context provided.",
            },
        )
    except Exception as exc:
        _raise_llm_http_error(exc)

    return {
        "transcript": transcript,
        "evaluation": rubric,
    }
