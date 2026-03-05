"""
Feature Toggle Routes
Endpoints for runtime configuration changes.

Security Notes:
- These endpoints should only be accessible from trusted networks
- In production, add authentication middleware
- Rate limiting prevents abuse
"""

import logging
import re
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

from services.feature_toggle_service import (
    switch_vector_db,
    get_current_db_info,
    list_available_dbs,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])

# Simple rate limiting for switch operations
_last_switch_time: float = 0
_MIN_SWITCH_INTERVAL_SECONDS = 5  # Minimum seconds between switches

# Allowed DB name pattern: alphanumeric, underscore, hyphen only
DB_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')


class SwitchDbRequest(BaseModel):
    dbName: str
    
    @field_validator('dbName')
    @classmethod
    def validate_db_name(cls, v: str) -> str:
        # Prevent path traversal and injection
        if not v or len(v) > 64:
            raise ValueError('dbName must be 1-64 characters')
        if not DB_NAME_PATTERN.match(v):
            raise ValueError('dbName must contain only alphanumeric, underscore, or hyphen')
        if v in ('.', '..') or v.startswith('.'):
            raise ValueError('Invalid dbName')
        return v


@router.post("/switch-db")
async def switch_db_endpoint(request: SwitchDbRequest, req: Request):
    """
    Switch the active vector database at runtime.
    
    POST /api/config/switch-db
    Body: { "dbName": "test3" }
    
    Security:
    - Input validated (alphanumeric, underscore, hyphen only)
    - Rate limited (one switch per 5 seconds)
    - Path traversal prevented
    """
    global _last_switch_time
    
    # Rate limiting
    now = time.time()
    if now - _last_switch_time < _MIN_SWITCH_INTERVAL_SECONDS:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Wait {_MIN_SWITCH_INTERVAL_SECONDS} seconds between switches."
        )
    
    client_ip = req.client.host if req.client else "unknown"
    logger.info("DB switch requested from %s: %s", client_ip, request.dbName)
    
    result = await switch_vector_db(request.dbName)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    _last_switch_time = now
    
    # Remove internal paths from response
    return {
        "success": result["success"],
        "dbName": result["dbName"],
        "documentCount": result["documentCount"],
        "message": result["message"],
    }


@router.get("/current-db")
async def get_current_db():
    """
    Get information about the currently active vector database.
    
    GET /api/config/current-db
    """
    return await get_current_db_info()


@router.get("/available-dbs")
async def get_available_dbs():
    """
    List all available vector databases.
    
    GET /api/config/available-dbs
    """
    result = await list_available_dbs()
    
    # Remove internal paths from response
    if result.get("success") and "databases" in result:
        sanitized_dbs = [
            {"name": db["name"], "active": db.get("active", False)}
            for db in result["databases"]
        ]
        return {
            "success": True,
            "databases": sanitized_dbs,
            "count": result["count"],
            "currentDb": result.get("currentDb"),
        }
    
    return {"success": False, "databases": [], "count": 0}
