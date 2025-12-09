"""
Startup Service
Handles the initialization of all LLM components on server startup
"""
import asyncio
import logging
from typing import Callable, List, Optional

from models.embedding_model import embedding_manager
from models.vectorstore import vectorstore_manager
from models.llm_model import llm_manager
from models.reranker_model import reranker_manager
from services.retriever_service import retriever_service
from services.rag_chain_service import rag_chain_service

logger = logging.getLogger(__name__)


class StartupService:
    """Manages the startup sequence for all LLM components"""

    def __init__(self):
        self._is_loaded = False
        self._loading_progress: List[str] = []

    async def initialize_all(
        self, progress_callback: Optional[Callable[[str, int], None]] = None
    ) -> bool:
        """
        Initialize all LLM components in the correct order.

        Args:
            progress_callback: Optional callback for progress updates (message, percentage)

        Returns:
            bool: True if all components loaded successfully
        """
        steps = [
            ("Loading embedding model...", self._load_embeddings, 15),
            ("Loading vector store...", self._load_vectorstore, 30),
            ("Loading LLM (Ollama)...", self._load_llm, 45),
            ("Loading reranker model...", self._load_reranker, 60),
            ("Loading reranked retriever...", self._load_retriever, 80),
            ("Initializing RAG chain...", self._load_rag_chain, 100),
        ]

        try:
            for message, loader, progress in steps:
                logger.info(message)
                self._loading_progress.append(message)

                if progress_callback:
                    progress_callback(message, progress)

                await loader()

            self._is_loaded = True
            logger.info("All LLM components initialized successfully!")
            return True

        except Exception as e:
            logger.error("Failed to initialize LLM components: %s", e)
            self._is_loaded = False
            raise

    async def _load_embeddings(self):
        """Load the embedding model"""
        await asyncio.to_thread(embedding_manager.load)

    async def _load_vectorstore(self):
        """Load the vector store"""
        await vectorstore_manager.load()

    async def _load_llm(self):
        """Load the Ollama LLM"""
        await asyncio.to_thread(llm_manager.load)

    async def _load_reranker(self):
        """Load the reranker model"""
        await asyncio.to_thread(reranker_manager.load)

    async def _load_retriever(self):
        """Load the reranked retriever"""
        await asyncio.to_thread(retriever_service.load)

    async def _load_rag_chain(self):
        """Initialize the RAG chain"""
        await asyncio.to_thread(rag_chain_service.initialize)

    def get_status(self) -> dict:
        """Get the current status of all components"""
        return {
            "is_loaded": self._is_loaded,
            "components": {
                "embedding_model": embedding_manager.is_loaded,
                "vectorstore": vectorstore_manager.is_loaded,
                "llm": llm_manager.is_loaded,
                "reranker": reranker_manager.is_loaded,
                "retriever": retriever_service.is_loaded,
                "rag_chain": rag_chain_service.is_ready
            },
            "loading_progress": self._loading_progress
        }

    @property
    def is_loaded(self) -> bool:
        """Return whether all LLM components are loaded."""
        return self._is_loaded

    def shutdown(self):
        """Cleanup and shutdown all components"""
        logger.info("Shutting down LLM components...")

        # Unload in reverse order
        retriever_service.unload()
        reranker_manager.unload()
        llm_manager.unload()
        vectorstore_manager.unload()
        embedding_manager.unload()

        self._is_loaded = False
        self._loading_progress = []
        logger.info("All LLM components shut down")


# Singleton instance
startup_service = StartupService()
