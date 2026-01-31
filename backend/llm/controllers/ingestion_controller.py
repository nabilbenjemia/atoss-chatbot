"""
Ingestion Controller for LLM Service

Handles business logic for:
- Document conversion via Docling
- ChromaDB collection management
- AI helper functions (vision, LLM)
- AI strategy functions (semantic chunking)
- Vector embedding and storage
"""
import logging
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

from config.settings import settings
from services.docling_service import DoclingService

logger = logging.getLogger(__name__)


class IngestionController:
    """
    Controller for ingestion operations.
    
    All methods return data directly (no HTTP responses).
    Routes handle HTTP concerns.
    """
    
    # =========================================================================
    # Collection Management
    # =========================================================================
    
    async def get_collections(self) -> List[Dict[str, Any]]:
        """
        Get all available ChromaDB collections from resources/chroma_db directory.
        
        Scans the chroma_db directory for subdirectories (each is a collection).
        Returns list of collection metadata.
        """
        try:
            collections = []
            chroma_db_dir = Path(settings.CHROMA_DB_DIRECTORY)
            
            if not chroma_db_dir.exists():
                logger.warning(f"ChromaDB directory not found: {chroma_db_dir}")
                return collections
            
            # Scan for subdirectories - each is a ChromaDB collection
            for item in sorted(chroma_db_dir.iterdir()):
                if item.is_dir():
                    collection_id = item.name
                    # Create human-readable label from directory name
                    label = collection_id.replace("_", " ").replace("chroma db", "ChromaDB").title()
                    
                    collections.append({
                        "id": collection_id,
                        "label": label,
                        "type": "chroma",
                        "path": str(item),
                        "isDefault": collection_id == "chroma_db_merged",
                    })
            
            logger.info(f"Found {len(collections)} ChromaDB collections: {[c['id'] for c in collections]}")
            return collections
            
        except Exception as e:
            logger.error(f"Failed to get collections: {e}")
            raise
    
    async def create_collection(
        self,
        name: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new ChromaDB collection.
        """
        try:
            # TODO: Implement actual ChromaDB collection creation
            logger.info(f"[MOCK] Creating collection: {name}")
            return {
                "success": True,
                "collection": {
                    "id": name,
                    "name": name,
                    "description": description,
                    "type": "chroma",
                    "createdAt": "2026-01-31T12:00:00.000Z",
                },
                "message": f"Collection '{name}' created successfully",
            }
        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            raise
    
   
    
    # =========================================================================
    # Document Conversion
    # =========================================================================
    
    async def convert_document(
        self,
        file_content: bytes,
        filename: str,
        content_type: str,
        config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Convert a document using Docling.
        
        Workflow:
        1. Save uploaded file to temp location
        2. Call DoclingService.convert_pdf() to get raw Docling JSON
        3. Call DoclingService.parse_to_ingestion_page() to transform to frontend format
        4. Clean up temp file
        5. Return frontend-ready content
        
        Args:
            file_content: Raw bytes of the uploaded file
            filename: Original filename
            content_type: MIME type (e.g., "application/pdf")
            config: Optional conversion configuration
            
        Returns:
            {
                "success": True,
                "filename": "document.pdf",
                "content": {
                    "documentId": "doc_xxx",
                    "filename": "document.pdf",
                    "totalPages": 10,
                    "pages": [...]
                }
            }
        """
        temp_file_path = None
        
        try:
            start_time = time.time()
            logger.info(f"[DoclingConversion] Starting conversion: {filename} ({len(file_content)} bytes)")
            
            # Validate content type
            supported_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
            if content_type not in supported_types:
                raise ValueError(f"Unsupported content type: {content_type}. Supported: {supported_types}")
            
            # Determine file extension from content type
            ext_map = {
                "application/pdf": ".pdf",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            }
            extension = ext_map.get(content_type, ".pdf")
            
            # Save to temp file (Docling requires file path)
            temp_dir = Path(tempfile.gettempdir()) / "docling_uploads"
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            temp_file_path = temp_dir / f"upload_{int(time.time() * 1000)}{extension}"
            temp_file_path.write_bytes(file_content)
            logger.info(f"[DoclingConversion] Saved temp file: {temp_file_path}")
            
            # Step 1: Convert PDF to Docling JSON (raw format)
            docling_service = DoclingService()
            docling_json = docling_service.convert_pdf(temp_file_path, verbose=True)
            
            conversion_time = time.time() - start_time
            logger.info(f"[DoclingConversion] Docling conversion completed in {conversion_time:.2f}s")
            
            # Generate document ID for this conversion
            import uuid
            document_id = f"doc_{uuid.uuid4().hex[:8]}"
            
            # Step 2: Transform to frontend ingestion page format
            # Images are saved to static/images/{document_id}/ and URLs returned
            parse_start = time.time()
            include_furniture = config.get("includeFurniture", False) if config else False
            save_images_to_disk = config.get("saveImagesToDisk", True) if config else True
            
            frontend_content = docling_service.parse_to_ingestion_page(
                docling_json, 
                include_furniture=include_furniture,
                document_id=document_id,
                save_images_to_disk=save_images_to_disk
            )
            
            # Override filename with original upload name
            frontend_content["filename"] = filename
            
            parse_time = time.time() - parse_start
            total_time = time.time() - start_time
            
            logger.info(
                f"[DoclingConversion] Complete: {filename} | "
                f"Pages: {frontend_content['totalPages']} | "
                f"Conversion: {conversion_time:.2f}s | "
                f"Parse: {parse_time:.2f}s | "
                f"Total: {total_time:.2f}s"
            )
            
            return {
                "success": True,
                "filename": filename,
                "content": frontend_content,
                "timing": {
                    "conversionSeconds": round(conversion_time, 2),
                    "parseSeconds": round(parse_time, 2),
                    "totalSeconds": round(total_time, 2),
                }
            }
            
        except Exception as e:
            logger.error(f"[DoclingConversion] Failed to convert document: {e}", exc_info=True)
            raise
            
        finally:
            # Clean up temp file
            if temp_file_path and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                    logger.debug(f"[DoclingConversion] Cleaned up temp file: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"[DoclingConversion] Failed to clean up temp file: {cleanup_error}")
    
    # =========================================================================
    # Ingestion
    # =========================================================================
    
    async def ingest_documents(
        self,
        collection_id: str,
        documents: List[Dict],
        strategy: str
    ) -> Dict[str, Any]:
        """
        Ingest documents into a ChromaDB collection.
        """
        try:
            # TODO: Implement actual vector embedding and storage
            logger.info(f"[MOCK] Ingesting {len(documents)} documents to {collection_id}")
            
            return {
                "success": True,
                "collectionId": collection_id,
                "strategy": strategy,
                "documentCount": len(documents),
                "message": f"Successfully ingested {len(documents)} documents to {collection_id}",
            }
        except Exception as e:
            logger.error(f"Failed to ingest documents: {e}")
            raise
    
    # =========================================================================
    # AI Helpers
    # =========================================================================
    
    async def generate_image_descriptions(
        self,
        document_id: str,
        images: List[Dict]
    ) -> Dict[str, Any]:
        """
        Generate AI descriptions for images using vision model.
        """
        try:
            # TODO: Implement actual vision model inference
            logger.info(f"[MOCK] Generating descriptions for {len(images)} images")
            
            descriptions = []
            for img in images:
                classification = img.get("classification", "unclassified")
                page_num = img.get("pageNumber", "unknown")
                
                # Generate classification-aware mock description
                desc = self._get_mock_description(classification, page_num)
                
                descriptions.append({
                    "imageId": img["id"],
                    "classification": classification,
                    "description": desc,
                })
            
            return {
                "success": True,
                "descriptions": descriptions,
                "message": f"Generated descriptions for {len(descriptions)} image(s)",
            }
        except Exception as e:
            logger.error(f"Failed to generate image descriptions: {e}")
            raise
    
    def _get_mock_description(self, classification: str, page_num: Any) -> str:
        """Get mock description based on classification"""
        prompts = {
            "logo": "This appears to be a company or brand logo.",
            "icon": "This is a small symbolic icon used for visual emphasis.",
            "bar_chart": "This is a bar chart presenting data with rectangular bars.",
            "line_chart": "This is a line chart showing trends over time or categories.",
            "pie_chart": "This is a pie chart showing proportional data distribution.",
            "flow_chart": "This is a flow chart illustrating a process or workflow.",
            "screenshot_from_computer": "This is a screenshot showing a software interface.",
            "screenshot_from_manual": "This is a screenshot from documentation or a manual.",
            "photograph": "This is a photograph capturing a real-world scene.",
            "table": "This is an image of a table containing structured data.",
            "diagram": "This is a diagram illustrating relationships or structures.",
        }
        base = prompts.get(classification, "This is a visual element from the document.")
        return f"{base} Found on page {page_num}. [Mock description - replace with actual AI vision model output]"
    
    async def run_helper(
        self,
        helper_id: str,
        request: Dict
    ) -> Dict[str, Any]:
        """
        Run a generic AI helper function.
        """
        try:
            # Route to specific helper implementation
            if helper_id == "ai_image_descriptions":
                return await self.generate_image_descriptions(
                    document_id=request.get("documentId"),
                    images=request.get("images", [])
                )
            elif helper_id == "ai_summarize_page":
                # TODO: Implement page summarization
                return {
                    "success": False,
                    "error": "Helper 'ai_summarize_page' not yet implemented",
                }
            else:
                return {
                    "success": False,
                    "error": f"Unknown helper: {helper_id}",
                }
        except Exception as e:
            logger.error(f"Failed to run helper {helper_id}: {e}")
            raise
    
    # =========================================================================
    # AI Strategies
    # =========================================================================
    
    async def run_strategy(
        self,
        strategy_id: str,
        document_state: Dict,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Run a remote AI strategy for semantic chunking.
        
        Returns pre-chunked documents ready for preview and ingestion.
        """
        try:
            if strategy_id == "semantic_sections":
                return await self._run_semantic_sections(document_state, options)
            elif strategy_id == "hierarchical":
                return await self._run_hierarchical(document_state, options)
            else:
                return {
                    "success": False,
                    "error": f"Unknown strategy: {strategy_id}",
                }
        except Exception as e:
            logger.error(f"Failed to run strategy {strategy_id}: {e}")
            raise
    
    async def _run_semantic_sections(
        self,
        document_state: Dict,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Run semantic sections strategy.
        
        AI identifies logical sections based on content meaning.
        """
        # TODO: Implement actual semantic chunking with LLM
        logger.info("[MOCK] Running semantic sections strategy")
        
        filename = document_state.get("filename", "document")
        total_pages = document_state.get("totalPages", 0)
        
        return {
            "success": True,
            "strategy": "semantic_sections",
            "preview": {
                "source": filename,
                "strategy": "semantic_sections",
                "total_embeddings": 2,
                "documents": [
                    {
                        "id": "section_intro",
                        "content": "Introduction section content...",
                        "metadata": {
                            "section_type": "introduction",
                            "semantic_topic": "overview",
                            "page_range": [1, 1],
                            "confidence": 0.92,
                        },
                    },
                    {
                        "id": "section_main",
                        "content": "Main content section...",
                        "metadata": {
                            "section_type": "body",
                            "semantic_topic": "main_content",
                            "page_range": [2, total_pages],
                            "confidence": 0.88,
                        },
                    },
                ],
            },
            "message": "[MOCK] Semantic sections strategy - replace with actual LLM implementation",
        }
    
    async def _run_hierarchical(
        self,
        document_state: Dict,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Run hierarchical chunking strategy.
        
        AI builds multi-level chunk hierarchy for parent-child retrieval.
        """
        # TODO: Implement actual hierarchical chunking with LLM
        logger.info("[MOCK] Running hierarchical strategy")
        
        return {
            "success": True,
            "strategy": "hierarchical",
            "preview": {
                "source": document_state.get("filename", "document"),
                "strategy": "hierarchical",
                "total_embeddings": 1,
                "documents": [
                    {
                        "id": "root",
                        "content": "Document summary...",
                        "metadata": {
                            "level": 0,
                            "parent": None,
                            "children": ["section_1", "section_2"],
                        },
                    },
                ],
            },
            "message": "[MOCK] Hierarchical strategy - replace with actual LLM implementation",
        }


# Singleton instance
ingestion_controller = IngestionController()
