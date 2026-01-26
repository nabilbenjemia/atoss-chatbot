"""
Reranker Model Manager
Handles document reranking using Jina Reranker v3 for improved relevance
"""

import logging
import time
from typing import Optional, List, Tuple, Any
from transformers import AutoModel
import torch

from config.settings import settings

logger = logging.getLogger(__name__)


class RerankerManager:
    """Manages the Jina Reranker v3 lifecycle"""

    _instance: Optional["RerankerManager"] = None
    _reranker: Optional[Any] = None
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

    def _resolve_device(self) -> str:
        """Resolve the best available device for the reranker"""
        device = settings.EMBEDDING_DEVICE.lower()

        if device == "auto":
            if torch.cuda.is_available():
                return "cuda"
            elif torch.backends.mps.is_available():
                return "mps"
            else:
                return "cpu"
        return device

    def load(self) -> bool:
        """Load the Jina Reranker v3 model"""
        if not settings.ENABLE_RERANKING:
            logger.info("Reranking is disabled in settings")
            return True

        if self._is_loaded:
            logger.info("Reranker already loaded")
            return True

        device = self._resolve_device()
        try:
            logger.info("Loading reranker model: %s", settings.RERANKING_MODEL)
            
            # Load Jina Reranker v3 with trust_remote_code for custom model code
            self._reranker = AutoModel.from_pretrained(
                settings.RERANKING_MODEL,
                torch_dtype="auto",
                trust_remote_code=True,
            )
            self._reranker.eval()
            
            # Move to appropriate device if not MPS (MPS handled internally)
            if device == "cuda":
                self._reranker = self._reranker.cuda()

            self._is_loaded = True
            logger.info("Reranker model loaded successfully on device: %s", device)
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load reranker model: %s", e)
            self._is_loaded = False
            return False

    def rerank(
        self, query: str, documents: List[str], top_k: Optional[int] = None
    ) -> List[Tuple[int, float]]:
        """
        Rerank documents based on relevance to query using Jina Reranker v3.

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
            k = top_k or settings.RERANKING_TOP_K
            
            start_time = time.time()
            
            # Use Jina Reranker v3's built-in rerank method
            results = self._reranker.rerank(query, documents)
            
            # Convert results to (index, score) tuples
            # Jina returns list of dicts with 'index', 'relevance_score', 'document'
            ranked = [(result['index'], result['relevance_score']) for result in results[:k]]
            
            elapsed_time = time.time() - start_time
            logger.info("Reranking completed in %.3f seconds for %d documents, returned top %d", 
                       elapsed_time, len(documents), len(ranked))
            
            return ranked

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
