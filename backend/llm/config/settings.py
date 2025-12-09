"""
LLM Server Configuration Settings
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_TEMPERATURE: float = 0.7
    OLLAMA_TOP_P: float = 0.9
    OLLAMA_NUM_CTX: int = 4096
    
    # Embedding Configuration
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cuda"  # or "cuda" for GPU
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "./data/chroma_db"
    CHROMA_COLLECTION_NAME: str = "atoss_documents"
    
    # Reranker Configuration
    RERANKER_MODEL: str = "ms-marco-MiniLM-L-12-v2"
    RERANKER_TOP_K: int = 5
    
    # Retrieval Configuration
    RETRIEVER_K: int = 10  # Initial retrieval count before reranking
    FINAL_K: int = 3  # Final documents after reranking
    
    # RAG Configuration
    MAX_CONTEXT_LENGTH: int = 3000
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()
