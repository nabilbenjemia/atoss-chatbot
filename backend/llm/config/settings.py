"""
LLM Server Configuration Settings
"""

from pydantic_settings import BaseSettings



class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:0.6b"
    OLLAMA_TEMPERATURE: float = 0.7
    OLLAMA_TOP_P: float = 0.7
    OLLAMA_NUM_CTX: int = 2048

    # Embedding Configuration
    EMBEDDING_MODEL: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_DEVICE: str = "cuda"  # or "cuda" for GPU

    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "./Chroma_ASES_Referenzhandbuch_db2"
    CHROMA_COLLECTION_NAME: str = "ASES_Referenzhandbuch"

    # Reranker Configuration
    RERANKER_MODEL: str = "jinaai/jina-reranker-v3"
    RERANKER_TOP_K: int = 5
    RERANKER_MAX_CHARS_PER_DOC: int = 256  # Truncate docs for faster reranking

    # Retrieval Configuration
    RETRIEVER_K: int = 16  # Initial retrieval count before reranking


    # RAG Configuration
    MAX_CONTEXT_LENGTH: int = 10000
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()
