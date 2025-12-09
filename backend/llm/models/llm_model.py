"""
LLM Model Manager
Handles Ollama LLM initialization and management
"""
import logging
from typing import Optional, AsyncIterator

from langchain_ollama import ChatOllama
from langchain.callbacks.base import AsyncCallbackHandler

from config.settings import settings

logger = logging.getLogger(__name__)


class StreamingCallbackHandler(AsyncCallbackHandler):
    """Custom callback handler for streaming responses"""

    def __init__(self):
        self.tokens = []

    async def on_llm_new_token(self, token: str, **kwargs):
        self.tokens.append(token)


class LLMManager:
    """Manages the Ollama LLM lifecycle"""

    _instance: Optional["LLMManager"] = None
    _llm: Optional[ChatOllama] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._llm = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the Ollama LLM"""
        if self._is_loaded:
            logger.info("LLM already loaded")
            return True

        try:
            logger.info("Loading Ollama LLM: %s", settings.OLLAMA_MODEL)

            self._llm = ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                temperature=settings.OLLAMA_TEMPERATURE,
                top_p=settings.OLLAMA_TOP_P,
                num_ctx=settings.OLLAMA_NUM_CTX,
                repeat_penalty=settings.OLLAMA_REPEAT_PENALTY,
                num_predict=settings.OLLAMA_NUM_PREDICT,
            )

            logger.info("Ollama LLM loaded successfully")
            self._is_loaded = True
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load Ollama LLM: %s", e)
            self._is_loaded = False
            return False

    def get_llm(self) -> ChatOllama:
        """Get the loaded LLM"""
        if not self._is_loaded or self._llm is None:
            raise RuntimeError("LLM not loaded. Call load() first.")
        return self._llm

    def get_streaming_llm(self) -> ChatOllama:
        """Get a streaming version of the LLM"""
        if not self._is_loaded:
            raise RuntimeError("LLM not loaded. Call load() first.")

        return self.get_llm()

    async def generate(self, prompt: str) -> str:
        """Generate a response from the LLM"""
        llm = self.get_llm()
        response = await llm.ainvoke(prompt)
        if isinstance(response.content, str):
            return response.content
        return str(response.content)

    async def stream_generate(self, prompt: str) -> AsyncIterator[str]:
        """Stream generate response from the LLM"""
        llm = self.get_streaming_llm()
        async for chunk in llm.astream(prompt):
            if hasattr(chunk, 'content') and isinstance(chunk.content, str):
                yield chunk.content
            elif isinstance(chunk, str):
                yield chunk

    @property
    def is_loaded(self) -> bool:
        """Check if LLM is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the LLM"""
        self._llm = None
        self._is_loaded = False
        logger.info("LLM unloaded")


# Singleton instance
llm_manager = LLMManager()
