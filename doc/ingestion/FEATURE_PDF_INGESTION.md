# Feature: PDF Document Ingestion Pipeline

This document describes the PDF document ingestion pipeline for populating the ChromaDB vector store with document embeddings.

---

## Overview

The ingestion pipeline extracts text from PDF documents, splits them into overlapping chunks, generates embeddings using SentenceTransformer, and stores them in ChromaDB for RAG (Retrieval-Augmented Generation) queries.

---

## Pipeline Architecture

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐
│ PDF Files   │───>│ Text Extraction │───>│ Chunking         │───>│ Embedding     │
│             │    │ (PyMuPDF/fitz)  │    │ (Overlapping)    │    │ (Snowflake)   │
└─────────────┘    └─────────────────┘    └──────────────────┘    └───────┬───────┘
                                                                          │
                                                                          ▼
                                                                   ┌─────────────┐
                                                                   │  ChromaDB   │
                                                                   │  Storage    │
                                                                   └─────────────┘
```

---

## Configuration

### Default Settings

| Parameter | Value | Description |
|-----------|-------|-------------|
| `PDF_FILES` | `["20251104_ATOSS FAQs_SEBA Lab.pdf", "ASES_Referenzhandbuch.pdf"]` | Source PDF files |
| `DB_PATH` | `./chroma_db_snowflake_600chunks_400overlapping` | ChromaDB storage path |
| `COLLECTION_NAME` | `tum_docs` | ChromaDB collection name |
| `EMBEDDING_MODEL` | `Snowflake/snowflake-arctic-embed-l-v2.0` | Embedding model |
| `CHUNK_SIZE` | `600` | Characters per chunk |
| `CHUNK_OVERLAP` | `400` | Overlapping characters between chunks |
| `BATCH_SIZE` | `32` | Embeddings batch size |

---

## File Location

```
backend/llm/
├── benchmark/
│   ├── __init__.py
│   ├── benchmark_llm.py     # LLM benchmarking tools
│   └── ingest.py            # 📍 PDF ingestion pipeline
└── ...
```

---

## Usage

### Running the Ingestion

```bash
cd backend/llm

# Activate virtual environment
source .venv/bin/activate  # Linux/macOS
# or
.\.venv\Scripts\Activate.ps1  # Windows PowerShell

# Run the ingestion
python -m benchmark.ingest
```

### Prerequisites

1. **PDF files** must be in the `backend/llm/` directory
2. **Dependencies** installed:
   - `PyMuPDF` (fitz)
   - `sentence-transformers`
   - `chromadb`
   - `torch`
   - `tqdm`

---

## Pipeline Steps

### Step 1: Text Extraction

The pipeline uses PyMuPDF (fitz) to extract text from each page of the PDF.

```python
doc = fitz.open(pdf_path)
for page_num, page in enumerate(doc):
    page_text = page.get_text().replace("\n", " ").replace("\r", " ").strip()
```

### Step 2: Chunking with Overlap

Text is split into overlapping chunks to preserve context across chunk boundaries.

```
Page Text: "Lorem ipsum dolor sit amet, consectetur..."
           ←───── CHUNK_SIZE (600) ─────→
Chunk 1:   [........................................]
           ←── OVERLAP (400) ──→
Chunk 2:                       [........................................]
```

```python
start = 0
while start < len(page_text):
    end = start + CHUNK_SIZE
    chunk = page_text[start:end]
    
    text_chunks.append({
        "id": f"{filename}_p{page_num + 1}_{start}",
        "text": chunk,
        "page": page_num + 1,
        "source": filename,
    })
    
    start += CHUNK_SIZE - CHUNK_OVERLAP  # Move by (600 - 400) = 200 chars
```

### Step 3: Embedding Generation

Chunks are embedded in batches using SentenceTransformer with the Snowflake model.

```python
model = SentenceTransformer(EMBEDDING_MODEL, trust_remote_code=True)

for batch in batches:
    batch_texts = [item["text"] for item in batch]
    batch_embeddings = model.encode(batch_texts, normalize_embeddings=True)
```

### Step 4: ChromaDB Storage

Embeddings are stored with metadata (page number, source file).

```python
collection.add(
    ids=[item["id"] for item in batch],
    embeddings=batch_embeddings.tolist(),
    documents=batch_texts,
    metadatas=[
        {"page": item["page"], "source": item["source"]} 
        for item in batch
    ],
)
```

---

## Data Structure

### Chunk Object

```python
{
    "id": "ATOSS_FAQs.pdf_p3_400",    # Unique ID: filename_page_startPos
    "text": "Lorem ipsum...",          # Chunk text content
    "page": 3,                         # Source page number
    "source": "ATOSS_FAQs.pdf"         # Source filename
}
```

### ChromaDB Entry

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique chunk identifier |
| `embedding` | `float[]` | 1024-dimensional vector (Snowflake) |
| `document` | `string` | Original chunk text |
| `metadata.page` | `int` | Source page number |
| `metadata.source` | `string` | Source filename |

---

## Logging Output

```
2025-01-19 10:30:00 - INFO - Using device: CUDA
2025-01-19 10:30:02 - INFO - Loading embedding model: Snowflake/snowflake-arctic-embed-l-v2.0
2025-01-19 10:30:15 - INFO - Connecting to ChromaDB at: ./chroma_db_snowflake_600chunks_400overlapping
2025-01-19 10:30:15 - INFO - Created new collection: tum_docs
2025-01-19 10:30:15 - INFO - Extracting text from: 20251104_ATOSS FAQs_SEBA Lab.pdf
2025-01-19 10:30:16 - INFO - ✅ Extracted 245 chunks from 20251104_ATOSS FAQs_SEBA Lab.pdf
2025-01-19 10:30:16 - INFO - Extracting text from: ASES_Referenzhandbuch.pdf
2025-01-19 10:30:18 - INFO - ✅ Extracted 512 chunks from ASES_Referenzhandbuch.pdf
2025-01-19 10:30:18 - INFO - Processing 757 chunks in batches of 32...
Embedding batches: 100%|████████████████████| 24/24 [00:45<00:00,  1.88s/it]
2025-01-19 10:31:03 - INFO - ✅ Ingestion complete! Database saved to './chroma_db_snowflake_600chunks_400overlapping'
```

---

## Important Notes

### 1. Collection Recreation
The pipeline **deletes and recreates** the collection on each run. This ensures a clean state but means existing data will be lost.

```python
try:
    client.delete_collection(COLLECTION_NAME)
except Exception:
    pass
collection = client.create_collection(name=COLLECTION_NAME)
```

### 2. GPU Acceleration
The pipeline automatically uses CUDA if available, otherwise falls back to CPU.

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
```

### 3. Missing PDF Handling
If a PDF file is not found, the pipeline logs a warning and continues with other files.

```python
if not os.path.exists(pdf_file):
    logger.warning(f"PDF file not found: {pdf_file}")
    continue
```

### 4. Overlap Strategy
The 400-character overlap (with 600-character chunks) ensures that:
- Context is preserved across chunk boundaries
- Semantic meaning is not lost at split points
- Approximately 67% overlap between consecutive chunks

---

## Integration with RAG Service

The ingested documents are used by the RAG chain service for retrieval:

```python
# In vectorstore_manager.py
collection = client.get_collection(name="tum_docs")
results = collection.query(query_embeddings=[query_embedding], n_results=k)
```

The metadata (page, source) is used for citations in the RAG response.

---

## Adding New Documents

To add new PDF documents:

1. Place the PDF file in `backend/llm/`
2. Update `PDF_FILES` in `ingest.py`:
   ```python
   PDF_FILES = [
       "20251104_ATOSS FAQs_SEBA Lab.pdf",
       "ASES_Referenzhandbuch.pdf",
       "new_document.pdf"  # Add new file
   ]
   ```
3. Run the ingestion script (note: this will re-embed all documents)

---

## Dependencies

```
PyMuPDF>=1.23.0
sentence-transformers>=2.2.0
chromadb>=0.4.0
torch>=2.0.0
tqdm>=4.65.0
```

These are included in `backend/llm/requirements.txt`.
