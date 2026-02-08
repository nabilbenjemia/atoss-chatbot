"""
Vector Store Manager
Handles ChromaDB vector store initialization and management.
Supports multiple collections for different document sets.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


import chromadb
from chromadb.api.models.Collection import Collection


from config.settings import settings
from models.embedding_model import embedding_manager

logger = logging.getLogger(__name__)


@dataclass
class Document:
    page_content: str
    metadata: Dict[str, Any]


class VectorStoreManager:
    """
    Manages ChromaDB vector store lifecycle.
    
    Supports multiple collections:
    - Default collection loaded at startup for RAG queries
    - Dynamic collection access for ingestion to different targets
    
    Architecture:
    - Each collection_id maps to a separate ChromaDB directory
    - Inside each directory, uses CHROMA_COLLECTION_NAME as the collection name
    - This allows isolated backup/deletion of collections
    
    Thread Safety:
    - Uses asyncio.Lock to prevent concurrent modifications during switch operations
    - Read operations (search) can proceed concurrently when not switching
    """

    _instance: Optional["VectorStoreManager"] = None
    
    # Default collection (for RAG queries)
    _default_client: Optional[chromadb.PersistentClient] = None
    _default_collection: Optional[Collection] = None
    _is_loaded: bool = False
    _current_db_name: Optional[str] = None  # Track current DB name
    
    # Cache of opened collections for ingestion
    _collection_cache: Dict[str, tuple] = {}
    
    # Lock for thread-safe switching
    _switch_lock: Optional[asyncio.Lock] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._default_client = None
            self._default_collection = None
            self._is_loaded = False
            self._current_db_name = None
            self._collection_cache = {}
            self._switch_lock = None  # Created lazily to ensure event loop exists

    @property
    def current_db_name(self) -> Optional[str]:
        """Get the name of the currently loaded vector database."""
        return self._current_db_name

    async def load(self) -> bool:
        """Load the default ChromaDB vector store for RAG queries"""
        if self._is_loaded:
            logger.info("Vector store already loaded")
            return True

        return await asyncio.to_thread(self._load_store)

    def _load_store(self) -> bool:
        """Load the default collection from CHROMA_PERSIST_DIRECTORY"""
        try:
            # Ensure embedding model is loaded first
            if not embedding_manager.is_loaded:
                raise RuntimeError("Embedding model must be loaded before vector store")

            persist_directory = settings.CHROMA_PERSIST_DIRECTORY
            if not os.path.exists(persist_directory) or not os.listdir(
                persist_directory
            ):
                logger.error("Vector store not found at: %s", persist_directory)
                raise RuntimeError(
                    "Vector store not found. Please run ingest.py first."
                )

            logger.info("Loading vector store from: %s", persist_directory)

            self._default_client = chromadb.PersistentClient(path=persist_directory)

            try:
                self._default_collection = self._default_client.get_collection(
                    name=settings.CHROMA_COLLECTION_NAME
                )
            except ValueError:
                raise RuntimeError(
                    f"Collection '{settings.CHROMA_COLLECTION_NAME}' not found in DB."
                )

            self._is_loaded = True
            # Extract DB name from path (last directory component)
            self._current_db_name = Path(persist_directory).name
            logger.info("Vector store loaded successfully")
            return True

        except Exception as e:
            logger.error("Failed to load vector store: %s", e)
            self._is_loaded = False
            raise

    def _get_collection_path(self, collection_id: str) -> Path:
        """
        Get the filesystem path for a collection.
        
        Each collection_id maps to a directory under CHROMA_DB_DIRECTORY.
        Example: resources/chroma_db/my_collection/
        """
        chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
        return chroma_base / collection_id

    def _get_or_create_collection(
        self, 
        collection_id: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple:
        """
        Get or create a ChromaDB collection for the given collection_id.
        
        Args:
            collection_id: Directory name for the collection
            metadata: Optional metadata for collection creation
            
        Returns:
            Tuple of (client, collection)
        """
        # Check cache first
        if collection_id in self._collection_cache:
            return self._collection_cache[collection_id]
        
        # Ensure embedding model is loaded
        if not embedding_manager.is_loaded:
            logger.info("Loading embedding model for ingestion...")
            embedding_manager.load()
        
        # Determine collection path
        collection_path = self._get_collection_path(collection_id)
        collection_path.mkdir(parents=True, exist_ok=True)
        
        logger.info("Opening collection at: %s", collection_path)
        
        # Create client and collection
        client = chromadb.PersistentClient(path=str(collection_path))
        # Only pass metadata if it's non-empty (ChromaDB rejects empty metadata dict)
        create_kwargs = {"name": settings.CHROMA_COLLECTION_NAME}
        if metadata:
            create_kwargs["metadata"] = metadata
        collection = client.get_or_create_collection(**create_kwargs)
        
        # Cache for reuse
        self._collection_cache[collection_id] = (client, collection)
        
        return client, collection

    async def create_collection(
        self,
        collection_id: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new ChromaDB collection.
        
        Creates a new directory for the collection and initializes ChromaDB.
        
        Args:
            collection_id: Unique identifier (becomes directory name)
            description: Optional description for the collection
            
        Returns:
            Success response with collection info
        """
        collection_path = self._get_collection_path(collection_id)
        
        # Check if collection already exists (check both cache and filesystem)
        if collection_id in self._collection_cache:
            return {
                "success": False,
                "error": f"Collection '{collection_id}' already exists",
            }
        
        # Check if directory exists and has ChromaDB data
        if collection_path.exists() and any(collection_path.iterdir()):
            return {
                "success": False,
                "error": f"Collection '{collection_id}' already exists",
            }
        
        # Create collection directory
        collection_path.mkdir(parents=True, exist_ok=True)
        logger.info("Creating new collection at: %s", collection_path)
        
        try:
            # Initialize ChromaDB client and collection in thread to avoid blocking
            def _init_collection():
                client = chromadb.PersistentClient(path=str(collection_path))
                # ChromaDB doesn't accept empty metadata dict, only pass if we have description
                create_kwargs = {"name": settings.CHROMA_COLLECTION_NAME}
                if description:
                    create_kwargs["metadata"] = {"description": description}
                collection = client.get_or_create_collection(**create_kwargs)
                return client, collection
            
            client, collection = await asyncio.to_thread(_init_collection)
            
            # Cache for reuse
            self._collection_cache[collection_id] = (client, collection)
            
            logger.info("Successfully created collection: %s", collection_id)
            
            return {
                "success": True,
                "collection": {
                    "id": collection_id,
                    "name": collection_id,  # Same as id for ChromaDB collections
                    "label": collection_id.replace("_", " ").title(),
                    "type": "chroma",
                    "path": str(collection_path),
                    "description": description,
                    "createdAt": datetime.now().isoformat(),
                },
                "message": f"Collection '{collection_id}' created successfully",
            }
        except Exception as e:
            logger.error("Failed to create collection '%s': %s", collection_id, e)
            # Clean up the empty directory if creation failed
            if collection_path.exists() and not any(collection_path.iterdir()):
                collection_path.rmdir()
            raise

    async def list_collections(self) -> List[Dict[str, Any]]:
        """
        List all available ChromaDB collections.
        
        Scans CHROMA_DB_DIRECTORY for collection subdirectories.
        Example: resources/chroma_db/my_collection/
        
        Returns:
            List of collection metadata dicts
        """
        collections = []
        chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
        
        if not chroma_base.exists():
            logger.warning("ChromaDB base directory not found: %s", chroma_base)
            return collections
        
        # Scan for subdirectories - each is a ChromaDB collection
        for item in sorted(chroma_base.iterdir()):
            if item.is_dir():
                collection_id = item.name
                # Create human-readable label
                label = collection_id.replace("_", " ").replace("chroma db", "ChromaDB").title()
                
                collections.append({
                    "id": collection_id,
                    "label": label,
                    "type": "chroma",
                    "path": str(item),
                    "isDefault": collection_id == "chroma_db_merged",
                })
        
        logger.info("Found %d ChromaDB collections", len(collections))
        return collections

    async def search(self, query: str, k: int = 8) -> List[Document]:
        """
        Native Similarity Search on default collection.
        
        1. Embeds the query using EmbeddingManager
        2. Queries ChromaDB default collection
        3. Returns a list of Document objects
        """
        if not self._is_loaded or self._default_collection is None:
            raise RuntimeError("Vector store not loaded. Call load() first.")

        # 1. Embed the user query
        query_vector = embedding_manager.embed_query(query)

        # 2. Query ChromaDB
        results = await asyncio.to_thread(
            self._default_collection.query,
            query_embeddings=[query_vector],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        # 3. Format results into Document objects
        documents = []

        if results["ids"] and len(results["ids"][0]) > 0:
            num_results = len(results["ids"][0])
            for i in range(num_results):
                content = results["documents"][0][i]
                meta = results["metadatas"][0][i]
                doc = Document(page_content=content, metadata=meta)
                documents.append(doc)

        return documents

    @property
    def is_loaded(self) -> bool:
        """Return whether the default vector store has been loaded."""
        return self._is_loaded

    async def ingest(
        self,
        collection_id: str,
        documents: List[Dict[str, Any]],
        strategy: str = "embed_per_page",
        batch_size: int = 32
    ) -> Dict[str, Any]:
        """
        Ingest documents into a specific collection.
        
        Args:
            collection_id: Target collection directory name
            documents: List of documents, each with:
                - id: unique document ID
                - content: text to embed
                - metadata: dict with source info
            strategy: Embedding strategy (for metadata)
            batch_size: Batch size for embedding
            
        Returns:
            Success response with ingestion stats
        """
        if not documents:
            return {
                "success": False,
                "error": "No documents provided for ingestion",
            }
        
        logger.info(
            "[Ingest] Starting ingestion of %d documents to '%s'",
            len(documents), collection_id
        )
        
        # Prepare data
        ids = []
        texts = []
        metadatas = []
        
        for i, doc in enumerate(documents):
            doc_id = doc.get('id', f'doc_{i}')
            content = doc.get('content', '')
            metadata = doc.get('metadata', {})
            
            if not content.strip():
                logger.warning("[Ingest] Skipping empty document: %s", doc_id)
                continue
            
            # Clean metadata - ChromaDB only accepts primitive types
            clean_metadata = self._clean_metadata(metadata)
        
            
            ids.append(doc_id)
            texts.append(content)
            metadatas.append(clean_metadata)
        
        if not ids:
            return {
                "success": False,
                "error": "No valid documents to ingest (all empty)",
            }
        
        # Batch embed all documents
        logger.info("[Ingest] Embedding %d documents...", len(texts))
        embeddings = await asyncio.to_thread(
            embedding_manager.embed_documents,
            texts,
            batch_size,
            True  # show_progress
        )
        
        # Check if this is the default collection path
        collection_path = self._get_collection_path(collection_id)
        default_path = os.path.normpath(os.path.abspath(settings.CHROMA_PERSIST_DIRECTORY))
        ingestion_path = os.path.normpath(os.path.abspath(str(collection_path)))
        
        if ingestion_path == default_path and self._is_loaded and self._default_collection:
            # Use default collection to avoid multiple clients on same files
            logger.info("[Ingest] Using default collection (same path)")
            collection = self._default_collection
        else:
            # Get or create a separate collection
            _, collection = await asyncio.to_thread(
                self._get_or_create_collection,
                collection_id,
                {"strategy": strategy}
            )
        
        # Add to ChromaDB
        logger.info("[Ingest] Adding %d documents to ChromaDB...", len(ids))
        await asyncio.to_thread(
            collection.add,
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts
        )
        
        logger.info(
            "[Ingest] Successfully ingested %d documents to '%s'",
            len(ids), collection_id
        )
        
        return {
            "success": True,
            "collectionId": collection_id,
            "collectionPath": str(collection_path),
            "strategy": strategy,
            "documentCount": len(ids),
            "totalChars": sum(len(t) for t in texts),
            "message": f"Successfully ingested {len(ids)} documents to {collection_id}",
        }

    def _clean_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean metadata for ChromaDB storage.
        
        ChromaDB only accepts primitive types (str, int, float, bool).
        Complex objects are converted to JSON strings.
        """
        clean = {}
        for key, value in metadata.items():
            if isinstance(value, (str, int, float, bool)):
                clean[key] = value
            elif isinstance(value, list):
                clean[key] = json.dumps(value)
            elif value is not None:
                clean[key] = str(value)
        return clean

    def clear_collection_cache(self):
        """Clear the collection cache to free resources."""
        self._collection_cache.clear()
        logger.info("Collection cache cleared")

    async def reload(self) -> bool:
        """
        Reload the default vector store to pick up newly ingested documents.
        
        This is called after ingestion to ensure the RAG chain uses the latest data.
        ChromaDB PersistentClient instances cache data - we need to fully close
        all clients and reopen to see changes.
        """
        logger.info("Reloading default vector store...")
        
        # Log cached clients being cleared
        if self._collection_cache:
            logger.info("Clearing %d cached collections", len(self._collection_cache))
        
        # Clear collection cache - allows garbage collection of clients
        self._collection_cache.clear()
        
        # Close default client
        if self._default_client:
            logger.info("Closing default client...")
        
        self._default_client = None
        self._default_collection = None
        self._is_loaded = False
        
        # Force garbage collection to ensure ChromaDB releases file handles
        import gc
        gc.collect()
        
        # Small delay to ensure file handles are released
        await asyncio.sleep(0.1)
        
        # Reload
        result = await self.load()
        doc_count = self._default_collection.count() if self._default_collection else 0
        logger.info("Vector store reloaded, documents: %d", doc_count)
        return result

    async def switch_collection(self, db_name: str) -> bool:
        """
        Switch to a different vector database by name.
        
        Unloads the current vector store and loads the new one.
        Collection name is the same across all DBs (CHROMA_COLLECTION_NAME).
        
        Thread-safe: Uses asyncio.Lock to prevent concurrent switches
        and ensure consistent state during the switch operation.
        
        Args:
            db_name: The database directory name (e.g., "test3", "production")
            
        Returns:
            True if successful, False otherwise
        """
        # Lazy init lock (must be created in async context)
        if self._switch_lock is None:
            self._switch_lock = asyncio.Lock()
        
        async with self._switch_lock:
            logger.info("Switching to vector database: %s", db_name)
            
            # Build path: CHROMA_DB_DIRECTORY / db_name
            chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
            db_path = chroma_base / db_name
            
            if not db_path.exists():
                logger.error("Vector database not found: %s", db_path)
                return False
            
            # Run blocking ChromaDB operations in thread pool
            try:
                success = await asyncio.to_thread(
                    self._switch_collection_sync, db_name, str(db_path)
                )
                return success
            except Exception as e:
                logger.error("Failed to switch to '%s': %s", db_name, e)
                self._is_loaded = False
                return False

    def _switch_collection_sync(self, db_name: str, db_path: str) -> bool:
        """
        Synchronous implementation of collection switch.
        Called from thread pool to avoid blocking the event loop.
        """
        # Unload current
        self._default_client = None
        self._default_collection = None
        self._is_loaded = False
        self._collection_cache.clear()
        
        logger.info("Loading vector store from: %s", db_path)
        self._default_client = chromadb.PersistentClient(path=db_path)
        self._default_collection = self._default_client.get_collection(
            name=settings.CHROMA_COLLECTION_NAME
        )
        self._is_loaded = True
        self._current_db_name = db_name
        
        doc_count = self._default_collection.count()
        logger.info("Switched to '%s', documents: %d", db_name, doc_count)
        return True

    def unload(self):
        """Unload all vector stores and clear cache"""
        self._default_client = None
        self._default_collection = None
        self._is_loaded = False
        self._collection_cache.clear()
        logger.info("Vector store unloaded")


# Singleton instance
vectorstore_manager = VectorStoreManager()
