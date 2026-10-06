import base64
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.core import config
from app.llm.chains import invoke_with_fallback, voice_explanation_rubric_chain

router = APIRouter(prefix="/api/speech", tags=["speech"])


class TranscribeRequest(BaseModel):
    audioBase64: str = Field(description="Base64-encoded audio bytes.")
    mimeType: str = Field(default="audio/webm")
    filename: Optional[str] = Field(default=None, description="Defaults to recording.<ext> for mimeType.")
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


# Whisper infers the container from the upload's file extension, so a Safari
# recording (audio/mp4) sent as "recording.webm" is rejected as unreadable.
_EXTENSION_BY_MIME = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}

# Whisper's upload limit.
MAX_AUDIO_BYTES = 25 * 1024 * 1024

UNREADABLE_RECORDING = (
    "The recording could not be transcribed. It may be too short, silent or in an "
    "unsupported format. Record at least a second of speech and try again."
)


def _upload_name(req: TranscribeRequest) -> tuple[str, str]:
    mime = req.mimeType.split(";", 1)[0].strip().lower()
    if not mime.startswith("audio/"):
        raise HTTPException(status_code=400, detail=f"mimeType must be an audio type, got {req.mimeType!r}.")
    if req.filename:
        return req.filename, mime
    return f"recording.{_EXTENSION_BY_MIME.get(mime, 'webm')}", mime


def _transcribe_audio(req: TranscribeRequest) -> str:
    """Blocking: makes a synchronous provider call. Run it via run_in_threadpool."""
    if not config.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Speech transcription unavailable: OPENAI_API_KEY not configured.")

    filename, mime = _upload_name(req)
    audio_bytes = _decode_audio(req.audioBase64)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audioBase64 decoded to empty payload.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Recording is larger than the 25 MB transcription limit.")

    import openai

    try:
        client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, mime),
            language=req.language or None,
        )
    except openai.BadRequestError:
        # The provider rejected the audio itself: retrying the same bytes cannot help,
        # so this is the caller's problem (422), not an outage (503).
        raise HTTPException(status_code=422, detail=UNREADABLE_RECORDING)
    except openai.RateLimitError as exc:
        raise HTTPException(status_code=429, detail=f"Speech transcription rate limited: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Speech transcription failed: {exc}")

    text = (response.text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="No speech was detected in the recording.")
    return text


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    # The provider call is synchronous; on the event loop it would stall every other
    # request this worker is serving for the length of the transcription.
    transcript = await run_in_threadpool(_transcribe_audio, req)
    return {"transcript": transcript}


@router.post("/evaluate-explanation")
async def evaluate_explanation(req: EvaluateExplanationRequest):
    transcript = await run_in_threadpool(_transcribe_audio, req)

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
