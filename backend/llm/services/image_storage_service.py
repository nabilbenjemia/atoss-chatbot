"""
Image Storage Service - Permanent storage for ingested document images.

This service handles moving images from temporary storage (static/images/)
to permanent storage (resources/pictures/) during document ingestion.

Architecture:
- Temporary: static/images/{doc_id}/ - Used during editing in frontend
- Permanent: resources/pictures/ - Used after ingestion, stored with UUIDs

Storage-agnostic design:
- Metadata stores relative path: "resources/pictures/{uuid}.{ext}"
- Backend adds appropriate prefix when serving:
  - Local: /llm/resources/pictures/{uuid}.{ext}
  - S3: https://bucket.s3.region.amazonaws.com/resources/pictures/{uuid}.{ext}
"""

import logging
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class ImageStorageService:
    """
    Service for managing permanent image storage.
    
    Handles copying images from temporary to permanent storage with UUID renaming.
    """
    
    # Base directory for LLM service
    BASE_DIR = Path(__file__).parent.parent
    
    # Temporary storage (frontend editing)
    TEMP_IMAGES_DIR = BASE_DIR / "static" / "images"
    
    # Permanent storage (after ingestion)
    PERMANENT_IMAGES_DIR = BASE_DIR / "resources" / "pictures"
    
    # Storage path prefix in metadata (storage-agnostic)
    STORAGE_PATH_PREFIX = "resources/pictures"

    def __init__(self):
        # Ensure permanent storage directory exists
        self.PERMANENT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    def migrate_image_to_permanent_storage(
        self,
        temp_image_url: str,
    ) -> Optional[str]:
        """
        Copy an image from temporary to permanent storage.
        
        Args:
            temp_image_url: Temporary image URL (e.g., "/static/images/doc_abc/i0.png")
            
        Returns:
            Permanent storage path (e.g., "resources/pictures/{uuid}.png")
            or None if migration fails
        """
        try:
            # Parse the temporary URL to get the file path
            # Expected format: /static/images/{doc_id}/{filename}
            if not temp_image_url or not temp_image_url.startswith("/static/images/"):
                logger.warning(f"Invalid temp image URL: {temp_image_url}")
                return None
            
            # Extract relative path from URL
            relative_path = temp_image_url.replace("/static/images/", "")
            temp_file_path = self.TEMP_IMAGES_DIR / relative_path
            
            if not temp_file_path.exists():
                logger.warning(f"Temp image file not found: {temp_file_path}")
                return None
            
            # Generate UUID for permanent storage
            image_uuid = str(uuid.uuid4())
            
            # Preserve original extension
            extension = temp_file_path.suffix.lower() or ".png"
            
            # Create permanent filename
            permanent_filename = f"{image_uuid}{extension}"
            permanent_file_path = self.PERMANENT_IMAGES_DIR / permanent_filename
            
            # Copy file to permanent storage
            shutil.copy2(temp_file_path, permanent_file_path)
            
            # Return storage-agnostic path
            permanent_url = f"{self.STORAGE_PATH_PREFIX}/{permanent_filename}"
            
            logger.info(f"Migrated image: {temp_image_url} -> {permanent_url}")
            return permanent_url
            
        except Exception as e:
            logger.error(f"Failed to migrate image {temp_image_url}: {e}")
            return None
    
    def process_documents_for_ingestion(
        self,
        documents: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
        """
        Process all documents before ingestion, migrating images to permanent storage.
        
        This method:
        1. Finds all images in document metadata
        2. Copies each image to permanent storage with UUID
        3. Updates imageUrl in metadata to permanent path
        
        Args:
            documents: List of documents with metadata containing images
            
        Returns:
            Tuple of:
            - Updated documents with new image URLs
            - Mapping of old URLs to new URLs (for reference)
        """
        url_mapping: Dict[str, str] = {}
        processed_count = 0
        skipped_count = 0
        
        for doc in documents:
            metadata = doc.get('metadata', {})
            images = metadata.get('images', [])
            
            if not images:
                continue
            
            # Process each image
            for image in images:
                old_url = image.get('imageUrl', '')
                
                # Skip if no URL or already in permanent storage
                if not old_url:
                    skipped_count += 1
                    continue
                    
                if old_url.startswith(self.STORAGE_PATH_PREFIX):
                    # Already in permanent storage
                    logger.debug(f"Image already in permanent storage: {old_url}")
                    continue
                
                # Check if we've already migrated this URL (same image used multiple times)
                if old_url in url_mapping:
                    image['imageUrl'] = url_mapping[old_url]
                    processed_count += 1
                    continue
                
                # Migrate to permanent storage
                new_url = self.migrate_image_to_permanent_storage(old_url)
                
                if new_url:
                    url_mapping[old_url] = new_url
                    image['imageUrl'] = new_url
                    processed_count += 1
                else:
                    # Keep original URL if migration fails
                    logger.warning(f"Keeping original URL due to migration failure: {old_url}")
                    skipped_count += 1
        
        logger.info(
            f"[ImageStorage] Processed {processed_count} images, "
            f"skipped {skipped_count}, migrated {len(url_mapping)} unique files"
        )
        
        return documents, url_mapping
    
    def get_serving_url(self, storage_path: str, storage_backend: str = "local") -> str:
        """
        Convert storage-agnostic path to full serving URL.
        
        Args:
            storage_path: Storage path (e.g., "resources/pictures/{uuid}.png")
            storage_backend: Storage backend type ("local", "s3", etc.)
            
        Returns:
            Full serving URL
        """
        if storage_backend == "local":
            # Local serving: prefix with /llm/
            return f"/llm/{storage_path}"
        elif storage_backend == "s3":
            # S3: would return full S3 URL
            # This is a placeholder for future implementation
            # bucket_url = settings.S3_BUCKET_URL
            # return f"{bucket_url}/{storage_path}"
            return f"/llm/{storage_path}"  # Fallback to local for now
        else:
            return f"/llm/{storage_path}"


# Singleton instance
image_storage_service = ImageStorageService()
