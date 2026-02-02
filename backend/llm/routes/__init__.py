"""
Routes package initialization
"""
from .chat_routes import router as chat_router
from .ingestion_routes import router as ingestion_router

__all__ = ["chat_router", "ingestion_router"]
