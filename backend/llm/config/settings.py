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
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen3:4b-instruct"
    OLLAMA_TEMPERATURE: float = 0.3  # Balanced creativity
    OLLAMA_NUM_CTX: int = 20000  # Larger context window
    OLLAMA_REPEAT_PENALTY: float = 1.15  # Moderate repetition penalty
    OLLAMA_NUM_PREDICT: int = 1000  # Precise Answers
    OLLAMA_KEEP_ALIVE: str = "-1"  # Keep model loaded in memory (-1 = forever)

    # Embedding Configuration
    EMBEDDING_MODEL: str = "Snowflake/snowflake-arctic-embed-l-v2.0"
    # Device selection: "auto" (recommended), "cuda", "mps" (Apple Silicon), or "cpu"
    EMBEDDING_DEVICE: str = "auto"

    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db_merged"
    CHROMA_COLLECTION_NAME: str = "tum_docs"

    # RAG Configuration
    MAX_CONTEXT_LENGTH: int = 10000
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 300

    # Reranking Configuration
    ENABLE_RERANKING: bool = False
    RERANKING_MODEL: str = "jinaai/jina-reranker-v3"
    RERANKING_TOP_K: int = 5  # Number of documents to keep after reranking

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()
