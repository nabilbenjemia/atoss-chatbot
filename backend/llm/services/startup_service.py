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
from models.vllm_model import vllm_manager
from models.reranker_model import reranker_manager
from services.rag_chain_service import rag_chain_service
from services.docling_service import DoclingService

logger = logging.getLogger(__name__)


class StartupService:
    """Manages the startup sequence for all LLM components"""

    def __init__(self):
        self._is_loaded = False
        self._loading_progress: List[str] = []
        self._docling_service: Optional[DoclingService] = None

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
            ("Loading Docling PDF converter...", self._load_docling, 10),
            ("Loading embedding model...", self._load_embeddings, 25),
            ("Loading vector store...", self._load_vectorstore, 40),
            ("Loading LLM (Ollama)...", self._load_llm, 55),
            ("Loading Vision LLM (Ollama)...", self._load_vllm, 70),
            ("Loading reranker (optional)...", self._load_reranker, 85),
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

    async def _load_docling(self):
        """Load the Docling PDF converter (initializes models on first use)"""
        # DoclingService is a singleton - instantiating it triggers model loading
        self._docling_service = await asyncio.to_thread(DoclingService)
        logger.info("Docling PDF converter initialized")

    async def _load_embeddings(self):
        """Load the embedding model"""
        await asyncio.to_thread(embedding_manager.load)

    async def _load_vectorstore(self):
        """Load the vector store (non-fatal if no default collection exists)"""
        result = await vectorstore_manager.load()
        if not result:
            logger.warning(
                "Default vector store not loaded - RAG chat unavailable. "
                "Ingestion endpoints are still available."
            )

    async def _load_llm(self):
        """Load the Ollama LLM"""
        await llm_manager.load()

    async def _load_vllm(self):
        """Load the Ollama Vision LLM for image understanding"""
        await vllm_manager.load()

    async def _load_reranker(self):
        """Load the cross-encoder reranker (optional, can be disabled)"""
        await asyncio.to_thread(reranker_manager.load)

    async def _load_rag_chain(self):
        """Verify RAG chain is ready (non-fatal if vector store is missing)"""
        if not rag_chain_service.is_ready:
            if not vectorstore_manager.is_loaded:
                logger.warning(
                    "RAG chain not ready - no vector store loaded. "
                    "Chat will be unavailable until a collection is ingested and loaded."
                )
                return
            raise RuntimeError("RAG Chain dependencies failed to load")
        logger.info("RAG chain check passed.")

    def get_status(self) -> dict:
        """Get the current status of all components"""
        return {
            "is_loaded": self._is_loaded,
            "components": {
                "docling": self._docling_service is not None,
                "embedding_model": embedding_manager.is_loaded,
                "vectorstore": vectorstore_manager.is_loaded,
                "llm": llm_manager.is_loaded,
                "vllm": vllm_manager.is_loaded,
                "reranker": reranker_manager.is_loaded,
                "rag_chain": rag_chain_service.is_ready,
            },
            "loading_progress": self._loading_progress,
        }

    @property
    def is_loaded(self) -> bool:
        """Return whether all LLM components are loaded."""
        return self._is_loaded

    def shutdown(self):
        """Cleanup and shutdown all components"""
        logger.info("Shutting down LLM components...")

        # Unload in reverse order
        reranker_manager.unload()
        vllm_manager.unload()
        llm_manager.unload()
        vectorstore_manager.unload()
        embedding_manager.unload()

        self._is_loaded = False
        self._loading_progress = []
        logger.info("All LLM components shut down")


# Singleton instance
startup_service = StartupService()
