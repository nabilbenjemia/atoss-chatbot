"""
Vector Store Manager
Handles ChromaDB vector store initialization and management
"""
import asyncio
import logging
import os
from typing import Optional, List, Dict, Any
from langchain.schema import Document

from config.settings import settings
from langchain_community.vectorstores import Chroma
from models.embedding_model import embedding_manager, QueryOnlyEmbeddings

logger = logging.getLogger(__name__)


class VectorStoreManager:
    """Manages the ChromaDB vector store lifecycle"""

    _instance: Optional["VectorStoreManager"] = None
    _vectorstore: Optional[Chroma] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance


    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._vectorstore = None
            self._is_loaded = False

    async def load(self) -> bool:
        """Load or initialize the ChromaDB vector store"""
        if self._is_loaded:
            logger.info("Vector store already loaded")
            return False

        return await asyncio.to_thread(self._load_store)

    def _load_store(self) -> bool:
        try:
            # Ensure embedding model is loaded first
            if not embedding_manager.is_loaded:
                raise RuntimeError("Embedding model must be loaded before vector store")

            embeddings = embedding_manager.get_embeddings()
            persist_directory = settings.CHROMA_PERSIST_DIRECTORY
            if not os.path.exists(persist_directory) or not os.listdir(persist_directory):
                logger.error("Vector store not found at: %s", persist_directory)
                raise RuntimeError("Vector store not found. Please create it before loading.")

            logger.info("Loading vector store from: %s", persist_directory)

            self._vectorstore = Chroma(
                collection_name=settings.CHROMA_COLLECTION_NAME,
                embedding_function=QueryOnlyEmbeddings(embeddings),
                persist_directory=persist_directory
            )
            self._is_loaded = True
            logger.info("Vector store loaded successfully")
            return True

        except Exception as e:
            logger.error("Failed to load vector store: %s", e)
            self._is_loaded = False
            raise


    def get_vectorstore(self) -> Chroma:
        """Get the loaded vector store"""
        if not self._is_loaded or self._vectorstore is None:
            raise RuntimeError("Vector store not loaded. Call load() first.")
        return self._vectorstore
    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """Perform similarity search on the vector store"""
        return self.get_vectorstore().similarity_search(query, k=k)

    def similarity_search_with_score(self, query: str, k: int = 4):
        """Perform similarity search with relevance scores"""
        return self.get_vectorstore().similarity_search_with_score(query, k=k)

    def add_documents(self, documents: List[Document]):
        """Add documents to the vector store"""
        self.get_vectorstore().add_documents(documents)
        logger.info("Added %d documents to vector store", len(documents))

    def get_retriever(self, search_kwargs: Optional[Dict[str, Any]] = None):
        """Get a retriever from the vector store"""
        if search_kwargs is None:
            search_kwargs = {"k": settings.RETRIEVER_K}
        return self.get_vectorstore().as_retriever(search_kwargs=search_kwargs)

    @property
    def is_loaded(self) -> bool:
        """Return whether the vector store has been loaded."""
        return self._is_loaded

    def unload(self):
        """Unload the vector store"""
        self._vectorstore = None
        self._is_loaded = False
        logger.info("Vector store unloaded")


# Singleton instance
vectorstore_manager = VectorStoreManager()
