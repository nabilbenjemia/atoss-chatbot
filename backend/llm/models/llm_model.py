"""
LLM Model Manager
Handles Ollama LLM initialization and management
"""

import logging
from typing import Optional, AsyncIterator, Dict, Any

from ollama import AsyncClient, ResponseError

from config.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """"You are an expert support assistant for the TUM University Hospital. "
                                "Your task is to answer user questions precisely based on the provided documents and chat history.\n"
                                "RULES:\n"
                                "1. ANSWER IN GERMAN ONLY.\n"
                                "2. USE ONLY the provided context.\n"
                                "3. FOLLOW STRICTLY ONE OF THESE TWO CASES:\n"
                                "   CASE A (Answer NOT found): If the context does not contain the answer, output EXACTLY this string and NOTHING else:\n"
                                "   'Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de'\n"
                                "   (STOP writing immediately after this sentence. Do NOT add any citations or page numbers in CASE A.)\n\n"
                                "   CASE B (Answer found): If the context contains the answer, provide a concise German answer first.\n"
                                "   Structure your response EXACTLY in this order:\n"
                                "   1. The Answer text.\n"
                                "   2. Two newlines.\n"
                                "   3. The Source at the very bottom.\n\n"
                                "   DO NOT start the answer with the source. The source must be the very last line.\n"
                                "   Example format:\n"
                                "   Example Answer\n\n"
                                "   [Quelle: Dateiname]\n"""


class LLMManager:
    """Manages the Ollama LLM lifecycle"""

    _instance: Optional["LLMManager"] = None
    _client: Optional[AsyncClient] = None
    _is_loaded: bool = False
    _model_params: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._llm = None
            self._is_loaded = False

            self._model_params = {
                "temperature": settings.OLLAMA_TEMPERATURE,
                "num_ctx": settings.OLLAMA_NUM_CTX,
                "repeat_penalty": settings.OLLAMA_REPEAT_PENALTY,
                "num_predict": settings.OLLAMA_NUM_PREDICT,
            }

    async def load(self) -> bool:
        """Load the Ollama LLM"""
        if self._is_loaded:
            logger.info("LLM already loaded")
            return True

        try:
            logger.info("Loading Ollama LLM: %s", settings.OLLAMA_MODEL)

            # Client initialisieren
            self._client = AsyncClient(host=settings.OLLAMA_BASE_URL)

            logger.info("Ollama LLM (%s) loaded successfully", settings.OLLAMA_MODEL)
            self._is_loaded = True
            return True

        except ResponseError as e:
            if e.status_code == 404:
                logger.error(
                    "Model '%s' not found. Please run 'ollama pull %s'",
                    settings.OLLAMA_MODEL,
                )
            else:
                logger.error("Ollama API Error: %s", e)
            self._is_loaded = False
            return False
        except Exception as e:
            logger.error("Failed to connect to Ollama: %s", e)
            self._is_loaded = False
            return False

    def get_client(self) -> AsyncClient:
        """Get the Ollama client"""
        if not self._is_loaded or self._client is None:
            raise RuntimeError("LLM not loaded. Call load() first.")
        return self._client

    async def generate(self, context: str, question: str) -> str:
        """Generate a response from the LLM"""
        client = self.get_client()
        try:
            response = await client.chat(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}",
                    },
                ],
                options=self._model_params,
                stream=False,
            )
            return response["message"]["content"]

        except Exception as e:
            logger.error("Error during LLM chat generation: %s", e)
            raise

    async def stream_generate(self, context: str, question: str) -> AsyncIterator[str]:
        """Stream generate response from the LLM"""
        client = self.get_client()

        try:
            async for chunk in await client.chat(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}",
                    },
                ],
                options=self._model_params,
                stream=True,
            ):
                # Bei chat streaming ist der Content in chunk['message']['content']
                yield chunk["message"]["content"]

        except Exception as e:
            logger.error("Error during LLM chat streaming: %s", e)
            raise

    @property
    def is_loaded(self) -> bool:
        """Check if LLM is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the LLM"""
        self._client = None
        self._is_loaded = False
        logger.info("LLM unloaded")


# Singleton instance
llm_manager = LLMManager()
