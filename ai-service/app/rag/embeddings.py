"""
Embedding provider abstraction.

Two things learned the hard way and encoded here:

1. Gemini's embed_content takes one text per call, and the free tier allows 100
   requests/minute. Bulk ingestion of a few hundred chunks is therefore not
   possible on Gemini without heavy throttling. OpenAI accepts many inputs per
   request, so it is the practical choice for ingestion at any scale.
2. The previous implementation had no retry and no cross-provider fallback on
   error: a 401 or 429 from the configured provider raised straight out and
   failed the whole ingest. LLM calls already had invoke_with_fallback; the
   embedding path now has the same resilience (F-16).
"""
from __future__ import annotations

import logging
import time
from typing import Callable, List, Optional

from app.core import config

log = logging.getLogger(__name__)

OPENAI_BATCH_SIZE = 128
GEMINI_MAX_RETRIES = 5


class EmbeddingError(RuntimeError):
    pass


def _is_rate_limit(exc: Exception) -> bool:
    text = str(exc).lower()
    return "429" in text or "resource_exhausted" in text or "rate limit" in text or "quota" in text


def _retry_seconds(exc: Exception, attempt: int) -> float:
    import re

    match = re.search(r"retry in (\d+(?:\.\d+)?)s", str(exc).lower())
    if match:
        return min(float(match.group(1)) + 1.0, 60.0)
    return min(2.0 ** attempt, 60.0)


class EmbeddingService:
    def __init__(self) -> None:
        self._openai = None
        self._gemini = None

        if config.OPENAI_API_KEY:
            from openai import OpenAI

            self._openai = OpenAI(api_key=config.OPENAI_API_KEY)

        if config.GEMINI_API_KEY:
            from google import genai

            self._gemini = genai.Client(api_key=config.GEMINI_API_KEY)

    # -- providers ---------------------------------------------------------
    def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for start in range(0, len(texts), OPENAI_BATCH_SIZE):
            batch = texts[start : start + OPENAI_BATCH_SIZE]
            resp = self._openai.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL, input=batch
            )
            out.extend(d.embedding for d in resp.data)
        return out

    def _embed_gemini(self, texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for text in texts:
            for attempt in range(GEMINI_MAX_RETRIES):
                try:
                    result = self._gemini.models.embed_content(
                        model=config.GEMINI_EMBEDDING_MODEL, contents=text
                    )
                    vectors.append(list(result.embeddings[0].values))
                    break
                except Exception as exc:
                    if _is_rate_limit(exc) and attempt < GEMINI_MAX_RETRIES - 1:
                        delay = _retry_seconds(exc, attempt)
                        log.warning("gemini embedding rate limited, sleeping %.1fs", delay)
                        time.sleep(delay)
                        continue
                    raise
        return vectors

    def _ordered_providers(self) -> List[tuple]:
        preferred = config.EMBEDDING_PROVIDER
        candidates = []
        if self._openai:
            candidates.append(("openai", self._embed_openai))
        if self._gemini:
            candidates.append(("gemini", self._embed_gemini))
        candidates.sort(key=lambda c: 0 if c[0] == preferred else 1)
        return candidates

    # -- public ------------------------------------------------------------
    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        providers = self._ordered_providers()
        if not providers:
            raise EmbeddingError(
                "No embedding provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY."
            )

        last: Optional[Exception] = None
        for name, fn in providers:
            try:
                return fn(texts)
            except Exception as exc:
                last = exc
                log.warning("embedding provider %s failed: %s", name, str(exc)[:160])
                # Never silently mix models: vectors from two providers have
                # different dimensionality and cannot share a collection. Falling
                # back is only safe for a whole call, which this is.
                continue

        raise EmbeddingError(f"all embedding providers failed; last error: {last}")

    @property
    def active_provider(self) -> str:
        providers = self._ordered_providers()
        return providers[0][0] if providers else "none"
