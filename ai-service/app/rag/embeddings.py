from typing import List
from app.core import config

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

    def embed(self, texts: List[str]) -> List[List[float]]:
        # Prefer OpenAI embeddings (reliable)
        if self._openai:
            r = self._openai.embeddings.create(
                model="text-embedding-3-small",
                input=texts,
            )
            return [d.embedding for d in r.data]

        # Gemini embedding only if you confirm a supported model name
        raise RuntimeError("No embedding provider configured (set OPENAI_API_KEY).")