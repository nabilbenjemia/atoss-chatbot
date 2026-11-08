"""
Feature Toggle Service
Allows runtime configuration changes without server restart.
"""

import logging
from pathlib import Path
from typing import Dict, Any

from config.settings import settings
from models.vectorstore import vectorstore_manager

logger = logging.getLogger(__name__)


async def switch_vector_db(db_name: str) -> Dict[str, Any]:
    """
    Switch the active vector database at runtime.
    
    Verifies the database exists and switches the vectorstore manager
    to use the new database for RAG queries.
    
    Args:
        db_name: The database directory name (e.g., "test3", "production")
        
    Returns:
        Dict with success status and info
    """
    logger.info("Request to switch vector DB to: %s", db_name)
    
    # Build and verify path
    chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
    db_path = chroma_base / db_name
    
    if not db_path.exists():
        logger.error("Vector DB not found: %s", db_path)
        return {
            "success": False,
            "error": f"Vector database '{db_name}' not found",
            "path": str(db_path),
        }
    
    # Check if it's a valid ChromaDB directory (has chroma.sqlite3)
    if not (db_path / "chroma.sqlite3").exists():
        logger.error("Invalid ChromaDB directory: %s", db_path)
        return {
            "success": False,
            "error": f"'{db_name}' is not a valid ChromaDB database",
            "path": str(db_path),
        }
    
    # Switch collection
    success = await vectorstore_manager.switch_collection(db_name)
    
    if success:
        doc_count = vectorstore_manager._default_collection.count() if vectorstore_manager._default_collection else 0
        logger.info("Successfully switched to '%s' with %d documents", db_name, doc_count)
        return {
            "success": True,
            "dbName": db_name,
            "path": str(db_path),
            "documentCount": doc_count,
            "message": f"Switched to '{db_name}' with {doc_count} documents",
        }
    else:
        return {
            "success": False,
            "error": f"Failed to switch to '{db_name}'",
            "path": str(db_path),
        }


async def get_current_db_info() -> Dict[str, Any]:
    """
    Get information about the currently active vector database.
    
    Returns:
        Dict with current DB info
    """
    if not vectorstore_manager.is_loaded:
        return {
            "loaded": False,
            "message": "No vector database loaded",
        }
    
    doc_count = vectorstore_manager._default_collection.count() if vectorstore_manager._default_collection else 0
    
    return {
        "loaded": True,
        "dbName": vectorstore_manager.current_db_name,
        "documentCount": doc_count,
        "collectionName": settings.CHROMA_COLLECTION_NAME,
    }


async def list_available_dbs() -> Dict[str, Any]:
    """
    List all available vector databases.
    
    Returns:
        Dict with list of available DBs
    """
    chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
    
    if not chroma_base.exists():
        return {
            "success": False,
            "error": f"ChromaDB directory not found: {chroma_base}",
            "databases": [],
        }
    
    current_db = vectorstore_manager.current_db_name
    databases = []
    for item in sorted(chroma_base.iterdir()):
        if item.is_dir() and (item / "chroma.sqlite3").exists():
            databases.append({
                "name": item.name,
                "path": str(item),
                "active": item.name == current_db,
            })
    
    return {
        "success": True,
        "databases": databases,
        "count": len(databases),
        "currentDb": current_db,
    }
