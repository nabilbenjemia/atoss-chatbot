"""
Ingestion Routes for LLM Service

Provides endpoints for:
- Document conversion (Docling)
- ChromaDB collection management
- Remote AI helpers (vision, LLM)
- Remote AI strategies (semantic chunking)
- Vector embedding and ingestion
"""
import json
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from controllers.ingestion_controller import ingestion_controller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# Load config
CONFIG_PATH = Path(__file__).parent.parent / "config" / "ingestion_config.json"
with open(CONFIG_PATH) as f:
    INGESTION_CONFIG = json.load(f)


# =============================================================================
# Request/Response Models
# =============================================================================

class ImageItem(BaseModel):
    """Image item for AI description generation"""
    id: str
    imageUrl: str
    classification: Optional[str] = "unclassified"
    pageNumber: Optional[int] = None


class ImageDescriptionsRequest(BaseModel):
    """Request for AI image descriptions"""
    documentId: str
    images: List[ImageItem]


class ImageDescription(BaseModel):
    """Single image description result"""
    imageId: str
    classification: str
    description: str


class ImageDescriptionsResponse(BaseModel):
    """Response for AI image descriptions"""
    success: bool
    descriptions: List[ImageDescription]
    message: str


class DocumentItem(BaseModel):
    """Document item (text, image, table)"""
    id: str
    type: str
    content: Optional[str] = None
    imageUrl: Optional[str] = None
    classification: Optional[str] = None
    deleted: bool = False


class PageItem(BaseModel):
    """Page with items"""
    pageNumber: int
    items: List[DocumentItem]


class DocumentState(BaseModel):
    """Full document state from frontend"""
    documentId: str
    filename: str
    totalPages: int
    pages: List[PageItem]


class StrategyRequest(BaseModel):
    """Request for running a strategy"""
    documentState: DocumentState
    options: Optional[dict] = None


class IngestRequest(BaseModel):
    """Request for ingesting documents into vector DB"""
    collectionId: str
    documents: List[dict]
    strategy: str


class CollectionCreateRequest(BaseModel):
    """Request for creating a new collection"""
    name: str
    description: Optional[str] = None


# =============================================================================
# Configuration Endpoints
# =============================================================================

@router.get("/config")
async def get_config():
    """
    Get ingestion configuration.
    
    Returns available remote strategies, helpers, embedding models.
    Collections are fetched dynamically from ChromaDB.
    """
    try:
        # Get dynamic collections from ChromaDB
        collections = await ingestion_controller.get_collections()
        
        return {
            "strategies": INGESTION_CONFIG["strategies"]["items"],
            "helpers": INGESTION_CONFIG["helpers"]["items"],
            "embeddingModels": INGESTION_CONFIG["embedding_models"]["items"],
            "collections": collections,
            "defaultCollection": INGESTION_CONFIG["default_collection"],
        }
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Collection Management Endpoints
# =============================================================================

@router.get("/collections")
async def list_collections():
    """
    List all available ChromaDB collections.
    """
    try:
        collections = await ingestion_controller.get_collections()
        return {
            "success": True,
            "collections": collections,
        }
    except Exception as e:
        logger.error(f"Failed to list collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collection")
async def create_collection(request: CollectionCreateRequest):
    """
    Create a new ChromaDB collection.
    """
    try:
        result = await ingestion_controller.create_collection(
            name=request.name,
            description=request.description
        )
        return result
    except Exception as e:
        logger.error(f"Failed to create collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collection/{collection_id}")
async def delete_collection(collection_id: str):
    """
    Delete a ChromaDB collection.
    """
    try:
        result = await ingestion_controller.delete_collection(collection_id)
        return result
    except Exception as e:
        logger.error(f"Failed to delete collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Document Conversion Endpoints
# =============================================================================

@router.post("/convert")
async def convert_document(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None)
):
    """
    Convert a PDF/PPTX document using Docling.
    
    Returns extracted content with pages, text items, images, and tables.
    Images include classification from Docling's picture classifier.
    """
    try:
        # Parse optional config
        config_dict = json.loads(config) if config else {}
        
        # Read file content
        file_content = await file.read()
        
        result = await ingestion_controller.convert_document(
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type,
            config=config_dict
        )
        return result
    except Exception as e:
        logger.error(f"Failed to convert document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Ingestion Endpoints
# =============================================================================

@router.post("/ingest")
async def ingest_documents(request: IngestRequest):
    """
    Ingest documents into a ChromaDB collection.
    
    Receives pre-chunked documents from frontend (for local strategies)
    or from strategy endpoint (for remote strategies).
    """
    try:
        result = await ingestion_controller.ingest_documents(
            collection_id=request.collectionId,
            documents=request.documents,
            strategy=request.strategy
        )
        return result
    except Exception as e:
        logger.error(f"Failed to ingest documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Remote Helper Endpoints
# =============================================================================

@router.post("/helper/ai_image_descriptions")
async def ai_image_descriptions(request: ImageDescriptionsRequest):
    """
    Generate AI descriptions for images using vision model.
    
    Receives images, returns descriptions that frontend applies to document.
    """
    try:
        result = await ingestion_controller.generate_image_descriptions(
            document_id=request.documentId,
            images=[img.model_dump() for img in request.images]
        )
        return result
    except Exception as e:
        logger.error(f"Failed to generate image descriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/helper/{helper_id}")
async def run_helper(helper_id: str, request: dict):
    """
    Run a generic remote helper by ID.
    """
    # Check if helper exists and is enabled
    helper = next(
        (h for h in INGESTION_CONFIG["helpers"]["items"] if h["id"] == helper_id),
        None
    )
    if not helper:
        raise HTTPException(status_code=404, detail=f"Helper '{helper_id}' not found")
    if not helper.get("enabled", False):
        raise HTTPException(status_code=400, detail=f"Helper '{helper_id}' is not enabled")
    
    try:
        result = await ingestion_controller.run_helper(helper_id, request)
        return result
    except Exception as e:
        logger.error(f"Failed to run helper {helper_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Remote Strategy Endpoints
# =============================================================================

@router.post("/strategy/{strategy_id}")
async def run_strategy(strategy_id: str, request: StrategyRequest):
    """
    Run a remote AI strategy to chunk document content.
    
    Returns pre-chunked documents ready for preview and ingestion.
    """
    # Check if strategy exists and is enabled
    strategy = next(
        (s for s in INGESTION_CONFIG["strategies"]["items"] if s["id"] == strategy_id),
        None
    )
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy_id}' not found")
    if not strategy.get("enabled", False):
        raise HTTPException(status_code=400, detail=f"Strategy '{strategy_id}' is not enabled")
    
    try:
        result = await ingestion_controller.run_strategy(
            strategy_id=strategy_id,
            document_state=request.documentState.model_dump(),
            options=request.options
        )
        return result
    except Exception as e:
        logger.error(f"Failed to run strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
