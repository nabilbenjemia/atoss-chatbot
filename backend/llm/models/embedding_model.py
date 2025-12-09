"""
Embedding Model Manager
Handles loading and managing the embedding model for vector representations
"""
import logging
from typing import Optional, List
from sentence_transformers import SentenceTransformer
from torch import Tensor
from langchain_core.embeddings import Embeddings

from config.settings import settings

logger = logging.getLogger(__name__)

class QueryOnlyEmbeddings(Embeddings):
    def __init__(self, model: SentenceTransformer):
        self.model = model

    def embed_documents(self, texts):
        """Not used"""
        pass

    def embed_query(self, text):
        return self.model.encode([text], convert_to_tensor=False)[0].tolist()


class EmbeddingManager:
    """Manages the embedding model lifecycle"""

    _instance: Optional["EmbeddingManager"] = None
    _embeddings: Optional[SentenceTransformer] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._embeddings = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the embedding model"""
        if self._is_loaded:
            logger.info("Embedding model already loaded")
            return True

        try:
            logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)

            self._embeddings = SentenceTransformer(
                model_name_or_path=settings.EMBEDDING_MODEL,
                device=settings.EMBEDDING_DEVICE,
                similarity_fn_name="cosine"
            )

            # Warm up the model with a test embedding
            _ = self._embeddings.encode("test")

            self._is_loaded = True
            logger.info("Embedding model loaded successfully")
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load embedding model: %s", e)
            self._is_loaded = False
            return False
            

    def get_embeddings(self) -> SentenceTransformer:
        """Get the loaded embedding model"""
        if not self._is_loaded or self._embeddings is None:
            raise RuntimeError("Embedding model not loaded. Call load() first.")
        return self._embeddings

    def embed_query(self, text: str) -> Tensor:
        """Embed a single query text"""
        return self.get_embeddings().encode(text)

    def embed_documents(self, texts: List[str]):
        """Embed multiple documents"""
        return self.get_embeddings().encode(texts)

    @property
    def is_loaded(self) -> bool:
        """Check if embedding model is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the embedding model to free memory"""
        self._embeddings = None
        self._is_loaded = False
        logger.info("Embedding model unloaded")


# Singleton instance
embedding_manager = EmbeddingManager()
