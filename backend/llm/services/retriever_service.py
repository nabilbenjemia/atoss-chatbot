"""
Retriever Service
Implements a reranking retriever that first retrieves documents and then reranks them
"""
import logging
import time
from typing import Optional, List

from langchain_core.documents import Document
from langchain.retrievers import ContextualCompressionRetriever

from config.settings import settings
from models.vectorstore import vectorstore_manager
from models.reranker_model import reranker_manager

logger = logging.getLogger(__name__)


class RetrieverService:
    """Service for document retrieval with reranking"""

    _instance: Optional["RetrieverService"] = None
    _reranked_retriever: Optional[ContextualCompressionRetriever] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._reranked_retriever = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the reranked retriever"""
        if self._is_loaded:
            logger.info("Retriever already loaded")
            return True

        try:
            # Ensure dependencies are loaded
            if not vectorstore_manager.is_loaded:
                raise RuntimeError("Vector store must be loaded before retriever")
            if not reranker_manager.is_loaded:
                raise RuntimeError("Reranker model must be loaded before retriever")

            logger.info("Initializing retriever with reranking...")

            # Create base retriever from vector store
            base_retriever = vectorstore_manager.get_retriever(
                search_kwargs={"k": settings.RETRIEVER_K}
            )

            # Get compressor from reranker manager
            compressor = reranker_manager.get_compressor()

            # Create compression retriever with reranking
            self._reranked_retriever = ContextualCompressionRetriever(
                base_compressor=compressor,
                base_retriever=base_retriever
            )

            self._is_loaded = True
            logger.info("Retriever loaded successfully")
            return True

        except RuntimeError as e:
            logger.error("Failed to load retriever: %s", e)
            self._is_loaded = False
            return False

    def get_retriever(self) -> ContextualCompressionRetriever:
        """Get the reranked retriever"""
        if not self._is_loaded or self._reranked_retriever is None:
            raise RuntimeError("Retriever not loaded. Call load() first.")
        return self._reranked_retriever

    async def retrieve(self, query: str) -> List[Document]:
        """Retrieve and rerank documents for a query"""
        logger.info("retrieve() starting for query: %s", query)
        start_time = time.perf_counter()
        retriever = self.get_retriever()
        documents = await retriever.ainvoke(query)
        elapsed = time.perf_counter() - start_time
        logger.info("retrieve() total time: %.3f seconds, got %d documents", elapsed, len(documents))
        return documents

    def retrieve_sync(self, query: str) -> List[Document]:
        """Synchronously retrieve and rerank documents"""
        retriever = self.get_retriever()
        documents = retriever.invoke(query)
        logger.info("Retrieved %d documents for query", len(documents))
        return documents

    @property
    def is_loaded(self) -> bool:
        """Check if retriever is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the retriever"""
        self._reranked_retriever = None
        self._is_loaded = False
        logger.info("Retriever unloaded")


# Singleton instance
retriever_service = RetrieverService()
