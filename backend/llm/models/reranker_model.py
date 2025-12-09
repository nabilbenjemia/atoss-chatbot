"""
Reranker Model
Implements a document compressor using Jina Reranker v3 for reranking retrieved documents
"""
import asyncio
import logging
import time
from typing import Any, Optional, Sequence

from langchain_core.callbacks import Callbacks
from langchain_core.documents import Document
from langchain_core.documents.compressor import BaseDocumentCompressor
from transformers import AutoModel

from config.settings import settings

logger = logging.getLogger(__name__)


class RerankerManager:
    """Manages the Jina Reranker v3 model lifecycle"""

    _instance: Optional["RerankerManager"] = None
    _model: Optional[Any] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._model = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the reranker model."""
        if self._is_loaded:
            logger.info("Reranker model already loaded")
            return True

        try:
            logger.info("Loading reranker model: %s", settings.RERANKER_MODEL)
            model = AutoModel.from_pretrained(
                settings.RERANKER_MODEL,
                torch_dtype="auto",
                trust_remote_code=True,
            )
            model.eval()
            self._model = model
            self._is_loaded = True
            logger.info("Reranker model loaded successfully")
            return True
        except (OSError, ValueError, RuntimeError) as e:
            logger.error("Failed to load reranker model: %s", e)
            self._is_loaded = False
            return False

    def get_model(self) -> Any:
        """Get the loaded reranker model"""
        if not self._is_loaded or self._model is None:
            raise RuntimeError("Reranker model not loaded. Call load() first.")
        return self._model

    def get_compressor(self) -> "JinaRerankerCompressor":
        """Get a document compressor using this reranker"""
        if not self._is_loaded or self._model is None:
            raise RuntimeError("Reranker model not loaded. Call load() first.")
        return JinaRerankerCompressor(manager=self)

    @property
    def is_loaded(self) -> bool:
        """Check if reranker model is loaded"""
        return self._is_loaded

    def unload(self) -> None:
        """Unload the reranker model to free memory"""
        self._model = None
        self._is_loaded = False
        logger.info("Reranker model unloaded")


class JinaRerankerCompressor(BaseDocumentCompressor):
    """Document compressor using Jina Reranker v3 model."""

    def __init__(self, manager: RerankerManager):
        super().__init__()
        self._manager = manager

    def compress_documents(
        self,
        documents: Sequence[Document],
        query: str,
        callbacks: Optional[Callbacks] = None,
    ) -> Sequence[Document]:
        """Compress documents by reranking them based on relevance to the query.

        Args:
            documents: The retrieved documents.
            query: The query context.
            callbacks: Optional callbacks to run during compression.

        Returns:
            The reranked documents, limited to top_n results.
        """
        model = self._manager.get_model()

        if not documents:
            return []

        # Truncate document texts for faster reranking
        # The reranker only needs enough text to determine relevance
        max_chars = settings.RERANKER_MAX_CHARS_PER_DOC
        doc_texts = [doc.page_content[:max_chars] for doc in documents]

        # Create a mapping from truncated text to original document
        # Use index-based mapping since truncated texts may collide
        index_to_doc = {i: doc for i, doc in enumerate(documents)}

        # Rerank documents using the Jina reranker
        # Results are sorted by relevance score (highest first)
        total_chars = sum(len(t) for t in doc_texts)
        logger.info(
            "Reranking %d documents (%d chars) for query: %s",
            len(documents), total_chars, query
        )
        start_time = time.perf_counter()
        results = model.rerank(query, doc_texts, top_n=settings.RERANKER_TOP_K)
        elapsed = time.perf_counter() - start_time
        logger.info("model.rerank() took %.3f seconds", elapsed)

        # Build reranked documents with scores in metadata
        # Use index from results to get original (non-truncated) document
        reranked_docs = []
        for result in results:
            idx = result["index"]
            original_doc = index_to_doc.get(idx)
            if original_doc is None:
                logger.warning("[Reranker] Original document not found for index: %d", idx)
                continue

            # Create a copy with rerank score in metadata
            reranked_doc = Document(
                page_content=original_doc.page_content,
                metadata={
                    **original_doc.metadata,
                    "rerank_score": float(result["relevance_score"])
                },
            )
            reranked_docs.append(reranked_doc)

        logger.info(
            "Reranked %d documents, returning top %d",
            len(documents),
            len(reranked_docs),
        )
        return reranked_docs
        

    async def acompress_documents(
        self,
        documents: Sequence[Document],
        query: str,
        callbacks: Optional[Callbacks] = None,
    ) -> Sequence[Document]:
        """Async version: Compress documents by reranking them based on relevance to the query.

        Args:
            documents: The retrieved documents.
            query: The query context.
            callbacks: Optional callbacks to run during compression.

        Returns:
            The reranked documents, limited to top_n results.
        """
        # Run the sync method in a thread pool to avoid blocking
        logger.info("acompress_documents starting for query: %s", query)
        start_time = time.perf_counter()
        result = await asyncio.to_thread(
            self.compress_documents, documents, query, callbacks
        )
        elapsed = time.perf_counter() - start_time
        logger.info("acompress_documents total time: %.3f seconds", elapsed)
        return result


# Singleton instance
reranker_manager = RerankerManager()
