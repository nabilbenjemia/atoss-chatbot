"""
ATOSS GPT - LLM Server
Main FastAPI application entry point

This server handles:
- Loading embedding models for vector representations
- Managing ChromaDB vector store for document retrieval
- Loading Ollama LLM for response generation
- Providing streaming chat API endpoints
"""
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from config.settings import settings
from routes.chat_routes import router as chat_router
from services.startup_service import startup_service

# Add the llm directory to the path for imports
sys.path.insert(0, ".")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events:
    - On startup: Initialize all LLM components (embeddings, vectorstore, LLM, retriever)
    - On shutdown: Clean up resources
    """
    # Startup
    logger.info("=" * 60)
    logger.info("ATOSS GPT LLM Server Starting...")
    logger.info("=" * 60)

    try:
        def progress_callback(message: str, progress: int):
            logger.info("[%d%%] %s", progress, message)

        await startup_service.initialize_all(progress_callback=progress_callback)

        logger.info("=" * 60)
        logger.info("LLM Server is ready to accept requests!")
        logger.info("API available at: http://%s:%s", settings.HOST, settings.PORT)
        logger.info("=" * 60)

    except (RuntimeError, OSError, ValueError) as e:
        logger.error("Failed to initialize LLM components: %s", e)
        logger.error("Server will start but LLM endpoints will not be available")

    yield

    # Shutdown
    logger.info("Shutting down LLM Server...")
    startup_service.shutdown()
    logger.info("LLM Server shutdown complete")
# Create FastAPI application
app = FastAPI(
    title="ATOSS GPT LLM Server",
    description="""
    LLM Server for ATOSS GPT chatbot application.

    This server provides:
    - RAG-based question answering with document retrieval
    - Streaming response generation using Ollama
    - Vector store management with ChromaDB
    - Reranking for improved retrieval quality
    """,
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving images from resources folder
resources_path = Path(__file__).parent / "docling" / "output" / "resources"
if resources_path.exists():
    app.mount("/resources", StaticFiles(directory=str(resources_path)), name="resources")
    logger.info(f"Serving static images from: {resources_path}")

# Include routers
app.include_router(chat_router)


@app.get("/")
async def root():
    """Root endpoint with basic server information"""
    return {
        "name": "ATOSS GPT LLM Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "status": "/api/chat/status",
            "generate": "/api/chat/generate",
            "stream": "/api/chat/stream",
            "health": "/api/chat/health"
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "LLM Server is ready"}


def main():
    """Main entry point to run the server"""
    logger.info("Starting server on %s:%s", settings.HOST, settings.PORT)
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )


if __name__ == "__main__":
    main()
