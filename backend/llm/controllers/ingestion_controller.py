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
        Get all available ChromaDB collections.
        
        Delegates to VectorStoreManager.list_collections().
        """
        from models.vectorstore import vectorstore_manager
        
        try:
            collections = await vectorstore_manager.list_collections()
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
        
        Delegates to VectorStoreManager.create_collection().
        """
        from models.vectorstore import vectorstore_manager
        
        try:
            result = await vectorstore_manager.create_collection(
                collection_id=name,
                description=description
            )
            return result
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
        
        Before ingestion, this method:
        1. Migrates images from temporary storage (static/images/) to
           permanent storage (resources/pictures/) with UUID filenames
        2. Updates imageUrl in metadata to use permanent storage paths
        
        Delegates to VectorStoreManager.ingest() which handles:
        - Batch embedding with EmbeddingManager
        - Collection management (create/get)
        - ChromaDB storage
        
        Each document should have:
        - id: unique document ID
        - content: text to embed
        - metadata: dict with source info (may include images with imageUrl)
        
        Args:
            collection_id: ChromaDB collection ID (directory name)
            documents: List of documents with id, content, metadata
            strategy: Embedding strategy used (for logging)
            
        Returns:
            Success response with ingestion stats
        """
        from models.vectorstore import vectorstore_manager
        from services.image_storage_service import image_storage_service
        
        try:
            # Count images before processing
            total_images = sum(
                len(doc.get('metadata', {}).get('images', []))
                for doc in documents
            )
            
            # Migrate images to permanent storage before ingestion
            if total_images > 0:
                logger.info(f"[Ingest] Processing {total_images} images for permanent storage...")
                documents, url_mapping = image_storage_service.process_documents_for_ingestion(documents)
                logger.info(f"[Ingest] Migrated {len(url_mapping)} unique images to permanent storage")
            
            # Delegate to VectorStoreManager
            result = await vectorstore_manager.ingest(
                collection_id=collection_id,
                documents=documents,
                strategy=strategy,
                batch_size=32
            )
            
            # Add image count to result
            if total_images > 0:
                result["totalImages"] = total_images
                result["migratedImages"] = len(url_mapping) if total_images > 0 else 0
            
            return result
            
        except Exception as e:
            logger.error(f"[Ingest] Failed to ingest documents: {e}", exc_info=True)
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
        
        Uses VisionLLMManager to generate descriptions for each image.
        Falls back to mock descriptions if vision model is unavailable.
        """
        from models.vllm_model import vllm_manager
        
        try:
            logger.info(f"Generating descriptions for {len(images)} images in document {document_id}")
            
            # Try to load vision model if not already loaded
            if not vllm_manager.is_loaded:
                try:
                    await vllm_manager.load()
                except Exception as e:
                    logger.warning(f"Vision model not available, using mock: {e}")
                   
            
            # Prepare images for batch processing
            batch_images = []
            skipped_count = 0
            for img in images:
                classification = img.get("classification", "unclassified")
                page_num = img.get("pageNumber", "unknown")
                image_url = img.get("imageUrl", "")
                
                # Skip images without URLs
                if not image_url:
                    logger.warning(f"Skipping image {img['id']}: no imageUrl provided")
                    skipped_count += 1
                    continue
                
                # Build classification-aware prompt
                prompt = self._get_description_prompt(classification, page_num)
                
                batch_images.append({
                    "id": img["id"],
                    "image": image_url,
                    "prompt": prompt,
                    "context": f"Document: {document_id}, Page: {page_num}, Classification: {classification}"
                })
            
            if skipped_count > 0:
                logger.info(f"Skipped {skipped_count} images without URLs")
            
            if not batch_images:
                logger.warning("No images with URLs to process")
                return {
                    "success": True,
                    "descriptions": [],
                    "message": "No images with URLs to process",
                }
            
            # Generate descriptions using vision model
            results = await vllm_manager.describe_images_batch(
                batch_images,
                default_prompt="Beschreibe dieses Bild aus einem Schulungsdokument kurz und prägnant."
            )
            
            # Format response
            descriptions = []
            for i, result in enumerate(results):
                img = images[i]
                descriptions.append({
                    "imageId": result["id"],
                    "classification": img.get("classification", "unclassified"),
                    "description": result.get("description", ""),
                    "error": result.get("error") if result.get("error") else None,
                })
            
            # Count successes
            success_count = sum(1 for d in descriptions if d["description"] and not d.get("error"))
            
            return {
                "success": True,
                "descriptions": descriptions,
                "message": f"Generated descriptions for {success_count}/{len(descriptions)} image(s)",
            }
        except Exception as e:
            logger.error(f"Failed to generate image descriptions: {e}")
            # Fall back to mock on error
            logger.info("Falling back to mock descriptions")
            return self._generate_default_descriptions(images)
    
    async def generate_image_descriptions_stream(
        self,
        document_id: str,
        images: List[Dict]
    ):
        """
        Stream AI descriptions for images using vision model.
        
        Yields each description as it's generated, enabling real-time UI updates.
        
        Yields:
            Dict with 'imageId', 'classification', 'description' or 'error'
        """
        from models.vllm_model import vllm_manager
        
        logger.info(f"Streaming descriptions for {len(images)} images in document {document_id}")
        
        # Try to load vision model if not already loaded
        if not vllm_manager.is_loaded:
            try:
                await vllm_manager.load()
            except Exception as e:
                logger.warning(f"Vision model not available: {e}")
                # Yield mock descriptions
                for img in images:
                    classification = img.get("classification", "unclassified")
                    page_num = img.get("pageNumber", "unknown")
                    yield {
                        "imageId": img["id"],
                        "classification": classification,
                        "description": self._get_default_description(classification, page_num),
                    }
                return
        
        # Process each image and yield result immediately
        for img in images:
            classification = img.get("classification", "unclassified")
            page_num = img.get("pageNumber", "unknown")
            image_url = img.get("imageUrl", "")
            
            # Skip images without URLs
            if not image_url:
                logger.warning(f"Skipping image {img['id']}: no imageUrl provided")
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "error": "No image URL provided",
                }
                continue
            
            # Build classification-aware prompt
            prompt = self._get_description_prompt(classification, page_num)
            
            try:
                description = await vllm_manager.describe_image(
                    image=image_url,
                    prompt=prompt,
                    context=f"Document: {document_id}, Page: {page_num}, Classification: {classification}"
                )
                logger.info(f"Generated description for image {img['id']}")
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "description": description,
                }
            except Exception as e:
                logger.error(f"Failed to describe image {img['id']}: {e}")
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "error": str(e),
                }
    
    def _generate_default_descriptions(self, images: List[Dict]) -> Dict[str, Any]:
        """Generate default descriptions when vision model is unavailable"""
        descriptions = []
        for img in images:
            classification = img.get("classification", "unclassified")
            page_num = img.get("pageNumber", "unknown")
            desc = self._get_default_description(classification, page_num)
            descriptions.append({
                "imageId": img["id"],
                "classification": classification,
                "description": desc,
            })
        return {
            "success": True,
            "descriptions": descriptions,
            "message": f"Generated mock descriptions for {len(descriptions)} image(s) (vision model unavailable)",
        }
    
    def _get_description_prompt(self, classification: str, page_num: Any) -> str:
        """Get classification-aware prompt for the vision model"""
        prompts = {
            "logo": "Beschreibe dieses Logo kurz. Was ist zu sehen und welches Unternehmen könnte es sein?",
            "icon": "Was zeigt dieses Icon? Beschreibe seine Bedeutung im Kontext einer Software-Anleitung.",
            "bar_chart": "Beschreibe dieses Balkendiagramm. Welche Daten werden dargestellt?",
            "line_chart": "Beschreibe dieses Liniendiagramm. Welche Trends sind erkennbar?",
            "pie_chart": "Beschreibe dieses Kreisdiagramm. Welche Verteilung wird gezeigt?",
            "flow_chart": "Beschreibe dieses Flussdiagramm. Welcher Prozess oder Arbeitsablauf wird dargestellt?",
            "screenshot_from_computer": "Beschreibe diesen Screenshot einer Software-Oberfläche. Welche Elemente sind sichtbar und was kann der Benutzer hier tun?",
            "screenshot_from_manual": "Beschreibe diesen Screenshot aus einer Anleitung. Welche Schritte oder Funktionen werden gezeigt?",
            "photograph": "Beschreibe dieses Foto kurz.",
            "table": "Beschreibe diese Tabelle. Welche Daten enthält sie?",
            "diagram": "Beschreibe dieses Diagramm. Welche Struktur oder Beziehungen werden dargestellt?",
        }
        base_prompt = prompts.get(classification, "Beschreibe dieses Bild aus einem Schulungsdokument.")
        return f"{base_prompt} Das Bild stammt von Seite {page_num}."
    
    def _get_default_description(self, classification: str, page_num: Any) -> str:
        """Get default description based on classification"""
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
        return f"{base} Found on page {page_num}. [default - vision model unavailable]"
    
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
