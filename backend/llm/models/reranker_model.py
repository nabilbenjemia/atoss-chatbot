"""
Reranker Model Manager
Handles cross-encoder based document reranking for improved relevance
"""

import logging
from typing import Optional, List, Tuple
from sentence_transformers import CrossEncoder
from .embedding_model import embedding_manager

from config.settings import settings

logger = logging.getLogger(__name__)


class RerankerManager:
    """Manages the cross-encoder reranker lifecycle"""

    _instance: Optional["RerankerManager"] = None
    _reranker: Optional[CrossEncoder] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._reranker = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the cross-encoder reranker model"""
        if not settings.ENABLE_RERANKING:
            logger.info("Reranking is disabled in settings")
            return True

        if self._is_loaded:
            logger.info("Reranker already loaded")
            return True

        device = embedding_manager._resolve_device()
        try:
            logger.info("Loading reranker model: %s", settings.RERANKING_MODEL)
            self._reranker = CrossEncoder(
                settings.RERANKING_MODEL,
                max_length=512,
                device=device,
            )

            self._is_loaded = True
            logger.info("Reranker model loaded successfully")
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load reranker model: %s", e)
            self._is_loaded = False
            return False

    def rerank(
        self, query: str, documents: List[str], top_k: Optional[int] = None
    ) -> List[Tuple[int, float]]:
        """
        Rerank documents based on relevance to query.

        Args:
            query: The search query
            documents: List of document texts to rerank
            top_k: Number of top documents to return. If None, uses settings.RERANKING_TOP_K

        Returns:
            List of (doc_index, score) tuples sorted by score descending
        """
        if (
            not settings.ENABLE_RERANKING
            or not self._is_loaded
            or self._reranker is None
        ):
            # If reranking disabled, return original order with dummy scores
            return [(i, 1.0) for i in range(len(documents))]

        if not documents:
            return []

        try:
            # Create query-document pairs
            pairs = [[query, doc] for doc in documents]

            # Get relevance scores
            scores = self._reranker.predict(pairs)

            # Create (index, score) tuples and sort by score descending
            ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)

            # Return top_k results
            k = top_k or settings.RERANKING_TOP_K
            return ranked[:k]

        except Exception as e:
            logger.error("Error during reranking: %s", e)
            # Fallback: return original order
            return [(i, 1.0) for i in range(len(documents))]

    @property
    def is_loaded(self) -> bool:
        """Check if reranker is loaded (or disabled)"""
        return not settings.ENABLE_RERANKING or self._is_loaded

    def unload(self):
        """Unload the reranker to free memory"""
        self._reranker = None
        self._is_loaded = False
        logger.info("Reranker unloaded")


# Singleton instance
reranker_manager = RerankerManager()
