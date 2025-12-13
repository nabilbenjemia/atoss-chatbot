"""
Vector Store Manager
Handles ChromaDB vector store initialization and management
"""

import asyncio
import logging
import os
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


import chromadb
from chromadb.api.models.Collection import Collection


from config.settings import settings
from models.embedding_model import embedding_manager

logger = logging.getLogger(__name__)


@dataclass
class Document:
    page_content: str
    metadata: Dict[str, Any]


class VectorStoreManager:
    """Manages the ChromaDB vector store lifecycle"""

    _instance: Optional["VectorStoreManager"] = None
    _client: Optional[chromadb.PersistentClient] = None
    _collection: Optional[Collection] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._client = None
            self._collection = None
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

            persist_directory = settings.CHROMA_PERSIST_DIRECTORY
            if not os.path.exists(persist_directory) or not os.listdir(
                persist_directory
            ):
                logger.error("Vector store not found at: %s", persist_directory)
                raise RuntimeError(
                    "Vector store not found. Please run ingest.py first."
                )

            logger.info("Loading vector store from: %s", persist_directory)

            self._client = chromadb.PersistentClient(path=persist_directory)

            try:
                self._collection = self._client.get_collection(
                    name=settings.CHROMA_COLLECTION_NAME
                )
            except ValueError:
                raise RuntimeError(
                    f"Collection '{settings.CHROMA_COLLECTION_NAME}' not found in DB."
                )

            self._is_loaded = True
            logger.info("Vector store loaded successfully")
            return True

        except Exception as e:
            logger.error("Failed to load vector store: %s", e)
            self._is_loaded = False
            raise

    async def search(self, query: str, k: int = 8) -> List[Document]:
        """
        Native Similarity Search:
        1. Embeds the query using EmbeddingManager
        2. Queries ChromaDB
        3. Returns a list of Document objects
        """
        if not self._is_loaded or self._collection is None:
            raise RuntimeError("Vector store not loaded. Call load() first.")

        # 1. Embed the user query
        # This calls your native embedding_manager (no LangChain wrapper needed)
        query_vector = embedding_manager.embed_query(query)

        # 2. Query ChromaDB
        # We perform this in a thread to keep the API async-friendly
        results = await asyncio.to_thread(
            self._collection.query,
            query_embeddings=[query_vector],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        # 3. Format results into Document objects
        # Chroma returns a dictionary of lists (e.g., results['documents'][0][i])
        documents = []

        # Check if we got results
        if results["ids"] and len(results["ids"][0]) > 0:
            num_results = len(results["ids"][0])
            for i in range(num_results):
                content = results["documents"][0][i]
                meta = results["metadatas"][0][i]

                # Create a clean Document object
                doc = Document(page_content=content, metadata=meta)
                documents.append(doc)

        return documents

    @property
    def is_loaded(self) -> bool:
        """Return whether the vector store has been loaded."""
        return self._is_loaded

    def unload(self):
        """Unload the vector store"""
        self._client = None
        self._collection = None
        self._is_loaded = False
        logger.info("Vector store unloaded")


# Singleton instance
vectorstore_manager = VectorStoreManager()
