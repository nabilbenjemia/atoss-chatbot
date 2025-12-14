"""
PDF Document Ingestion Pipeline

Extracts text from PDF documents, creates embeddings using SentenceTransformer,
and stores them in ChromaDB with batch processing for efficiency.
"""

import logging
import os
from typing import List, Dict, Any

import fitz  # PyMuPDF
import torch
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import chromadb

# Configuration
PDF_FILES = ["20251104_ATOSS FAQs_SEBA Lab.pdf", "ASES_Referenzhandbuch.pdf"]
DB_PATH = "./chroma_db_snowflake_600chunks_400overlapping"
COLLECTION_NAME = "tum_docs"
EMBEDDING_MODEL = "Snowflake/snowflake-arctic-embed-l-v2.0"

# Chunk configuration
CHUNK_SIZE = 600
CHUNK_OVERLAP = 400
BATCH_SIZE = 32

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def extract_text_chunks(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from PDF and split into overlapping chunks.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        List of chunk dictionaries with id, text, page, and source
    """
    logger.info(f"Extracting text from: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
        text_chunks = []
        filename = os.path.basename(pdf_path)

        for page_num, page in enumerate(doc):
            page_text = page.get_text().replace("\n", " ").replace("\r", " ").strip()

            # Create overlapping chunks
            start = 0
            while start < len(page_text):
                end = start + CHUNK_SIZE
                chunk = page_text[start:end]
                unique_id = f"{filename}_p{page_num + 1}_{start}"

                text_chunks.append(
                    {
                        "id": unique_id,
                        "text": chunk,
                        "page": page_num + 1,
                        "source": filename,
                    }
                )

                start += CHUNK_SIZE - CHUNK_OVERLAP

        doc.close()
        logger.info(f"✅ Extracted {len(text_chunks)} chunks from {pdf_path}")
        return text_chunks

    except Exception as e:
        logger.error(f"❌ Error extracting text from {pdf_path}: {e}")
        raise


def ingest():
    """Main ingestion pipeline."""
    try:
        # Setup device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device.upper()}")

        # Load embedding model
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        model = SentenceTransformer(EMBEDDING_MODEL, trust_remote_code=True)

        # Setup ChromaDB
        logger.info(f"Connecting to ChromaDB at: {DB_PATH}")
        client = chromadb.PersistentClient(path=DB_PATH)

        # Recreate collection
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass

        collection = client.create_collection(name=COLLECTION_NAME)
        logger.info(f"Created new collection: {COLLECTION_NAME}")

        # Extract all chunks from PDFs
        all_chunks = []
        for pdf_file in PDF_FILES:
            if not os.path.exists(pdf_file):
                logger.warning(f"PDF file not found: {pdf_file}")
                continue
            chunks = extract_text_chunks(pdf_file)
            all_chunks.extend(chunks)

        if not all_chunks:
            logger.error("No chunks extracted from any PDF files")
            return

        # Batch process embeddings and store in DB
        logger.info(
            f"Processing {len(all_chunks)} chunks in batches of {BATCH_SIZE}..."
        )

        for i in tqdm(range(0, len(all_chunks), BATCH_SIZE), desc="Embedding batches"):
            batch = all_chunks[i : i + BATCH_SIZE]

            # Extract texts from batch
            batch_texts = [item["text"] for item in batch]

            # Generate embeddings
            batch_embeddings = model.encode(batch_texts, normalize_embeddings=True)

            # Store in ChromaDB
            collection.add(
                ids=[item["id"] for item in batch],
                embeddings=batch_embeddings.tolist(),
                documents=batch_texts,
                metadatas=[
                    {"page": item["page"], "source": item["source"]} for item in batch
                ],
            )

        logger.info(f"✅ Ingestion complete! Database saved to '{DB_PATH}'")

    except Exception as e:
        logger.error(f"❌ Ingestion failed: {e}")
        raise


if __name__ == "__main__":
    ingest()
