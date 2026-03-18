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
        provider = config.EMBEDDING_PROVIDER

        if provider == "openai" and self._openai:
            r = self._openai.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL,
                input=texts,
            )
            return [d.embedding for d in r.data]

        if provider == "gemini" and self._gemini:
            vectors: List[List[float]] = []
            for text in texts:
                result = self._gemini.models.embed_content(
                    model=config.GEMINI_EMBEDDING_MODEL,
                    contents=text,
                )
                vectors.append(list(result.embeddings[0].values))
            return vectors

        if self._openai:
            r = self._openai.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL,
                input=texts,
            )
            return [d.embedding for d in r.data]

        if self._gemini:
            vectors: List[List[float]] = []
            for text in texts:
                result = self._gemini.models.embed_content(
                    model=config.GEMINI_EMBEDDING_MODEL,
                    contents=text,
                )
                vectors.append(list(result.embeddings[0].values))
            return vectors

        raise RuntimeError("No embedding provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.")