"""
Reranker Retriever Service
Implements a reranking retriever that first retrieves documents and then reranks them
"""
import logging
from typing import Optional, List
from langchain_core.documents import Document

from FlagEmbedding import FlagReranker

from config.settings import settings
from models.vectorstore import vectorstore_manager

logger = logging.getLogger(__name__)


class RerankerRetrieverService:
    """Service for document retrieval with reranking"""
    
    _instance: Optional["RerankerRetrieverService"] = None
    _reranked_retriever: Optional[FlagReranker] = None
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
    
    async def load(self) -> bool:
        """Load the reranked retriever"""
        if self._is_loaded:
            logger.info("Reranked retriever already loaded")
            return True
        
        try:
            # Ensure vector store is loaded first
            if not vectorstore_manager.is_loaded:
                raise RuntimeError("Vector store must be loaded before reranked retriever")
            
            logger.info("Loading reranker model: %s", settings.RERANKER_MODEL)
            
            # Create base retriever from vector store
            base_retriever = vectorstore_manager.get_retriever(
                search_kwargs={"k": settings.RETRIEVER_K}
            )
            
            # Create reranker compressor
            compressor = FlashrankRerank(
                model=settings.RERANKER_MODEL,
                top_n=settings.FINAL_K
            )
            
            # Create compression retriever with reranking
            self._reranked_retriever = ContextualCompressionRetriever(
                base_compressor=compressor,
                base_retriever=base_retriever
            )
            
            self._is_loaded = True
            logger.info("Reranked retriever loaded successfully")
            return True
            
        except Exception as e:
            logger.error("Failed to load reranked retriever: %s", e)
            self._is_loaded = False
            raise
    
    def get_retriever(self) -> ContextualCompressionRetriever:
        """Get the reranked retriever"""
        if not self._is_loaded or self._reranked_retriever is None:
            raise RuntimeError("Reranked retriever not loaded. Call load() first.")
        return self._reranked_retriever
    
    async def retrieve(self, query: str) -> List[Document]:
        """Retrieve and rerank documents for a query"""
        retriever = self.get_retriever()
        documents = await retriever.ainvoke(query)
        logger.info("Retrieved %d documents for query", len(documents))
        return documents
    
    def retrieve_sync(self, query: str) -> List[Document]:
        """Synchronously retrieve and rerank documents"""
        retriever = self.get_retriever()
        documents = retriever.invoke(query)
        logger.info("Retrieved %d documents for query", len(documents))
        return documents
    
    @property
    def is_loaded(self) -> bool:
        return self._is_loaded
    
    def unload(self):
        """Unload the reranked retriever"""
        self._reranked_retriever = None
        self._is_loaded = False
        logger.info("Reranked retriever unloaded")


# Singleton instance
retriever_service = RerankerRetrieverService()
