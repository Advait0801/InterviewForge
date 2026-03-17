from app.core import config

class LLMService:
    def __init__(self) -> None:
        self._gemini = None
        self._openai = None

        if config.GEMINI_API_KEY:
            try:
                from google import genai  # google-genai
                self._gemini = genai.Client(api_key=config.GEMINI_API_KEY)
            except Exception:
                self._gemini = None

        if config.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self._openai = OpenAI(api_key=config.OPENAI_API_KEY)
            except Exception:
                self._openai = None

    def available_provider(self) -> str:
        if self._gemini:
            return "gemini"
        if self._openai:
            return "openai"
        return "none"

    async def generate(self, prompt: str) -> str:
        # Gemini primary
        if self._gemini:
            resp = self._gemini.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=prompt,
            )
            return (resp.text or "").strip()

        # OpenAI fallback
        if self._openai:
            resp = self._openai.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content.strip()

        raise RuntimeError("No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.")