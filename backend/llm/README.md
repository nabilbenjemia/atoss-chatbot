# LLM Server

Python-based FastAPI server providing RAG (Retrieval-Augmented Generation) capabilities using Ollama, ChromaDB, Sentence Transformers, and Docling document processing.

## Features

- **Ollama LLM Integration** - Local LLM inference with streaming support (Qwen, Granite models)
- **Vision LLM** - Image understanding via Granite Vision model
- **ChromaDB Vector Store** - Persistent multi-collection document storage and similarity search
- **Sentence Transformers Embeddings** - Snowflake Arctic Embed for high-quality embeddings
- **Jina Reranker** - Optional document reranking for improved retrieval quality
- **Docling Document Processing** - PDF/PPTX conversion with image classification
- **Streaming Responses** - Real-time SSE token-by-token response generation
- **Runtime Database Switching** - Switch between vector databases without restart

## Prerequisites

- **Python 3.11 or 3.12** (3.13+ not yet supported due to ChromaDB/onnxruntime compatibility)
- [Ollama](https://ollama.ai/) installed and running locally
- CUDA-compatible GPU (optional, for faster embeddings; MPS supported on macOS)

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend/llm

# Create virtual environment with Python 3.11 or 3.12
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows PowerShell)
# .\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env file with your settings (defaults work for local development)
```

### 4. Pull Ollama Models

```bash
ollama pull qwen3:4b-instruct
ollama pull granite3.2-vision:2b
```

### 5. Start the Server

```bash
python main.py
# or
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at `http://localhost:8000`.

## API Endpoints

### Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/status` | GET | LLM service status with component info |
| `/api/chat/generate` | POST | Generate complete response with sources |
| `/api/chat/stream` | POST | Stream response as SSE |
| `/api/chat/health` | GET | Simple health check |

### Ingestion

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/config` | GET | Get ingestion configuration (strategies, helpers, models, collections) |
| `/api/ingestion/collections` | GET | List all ChromaDB collections |
| `/api/ingestion/collection` | POST | Create new collection |
| `/api/ingestion/convert` | POST | Convert PDF/PPTX using Docling |
| `/api/ingestion/ingest` | POST | Ingest documents into vector database |
| `/api/ingestion/helper/ai_image_descriptions` | POST | Generate image descriptions using vision model |
| `/api/ingestion/helper/ai_image_descriptions/stream` | POST | Stream image descriptions as SSE |
| `/api/ingestion/helper/{helper_id}` | POST | Run remote helper |
| `/api/ingestion/strategy/{strategy_id}` | POST | Run remote semantic chunking strategy |

### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/switch-db` | POST | Switch active vector database |
| `/api/config/current-db` | GET | Get current database info |
| `/api/config/available-dbs` | GET | List available databases |

### General

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint with API overview |
| `/api/health` | GET | Health check |
| `/docs` | GET | Swagger API documentation |

## Vector Database Management

The server supports multiple ChromaDB vector databases. You can switch between databases at runtime without restarting the server.

### List Available Databases

```bash
curl http://localhost:8000/api/config/available-dbs
```

Response:
```json
{
  "success": true,
  "databases": [
    {"name": "tum_docs", "active": true},
    {"name": "test3", "active": false}
  ],
  "count": 2,
  "currentDb": "tum_docs"
}
```

### Check Current Database

```bash
curl http://localhost:8000/api/config/current-db
```

Response:
```json
{
  "loaded": true,
  "dbName": "tum_docs",
  "documentCount": 150,
  "collectionName": "tum_docs"
}
```

### Switch Database

```bash
curl -X POST http://localhost:8000/api/config/switch-db \
  -H "Content-Type: application/json" \
  -d '{"dbName": "test3"}'
```

**Security:** Database names must be alphanumeric with underscores/hyphens only (1-64 chars). Rate limited to one switch per 5 seconds. Path traversal attempts are blocked.

### Create a New Collection

```bash
curl -X POST http://localhost:8000/api/ingestion/collection \
  -H "Content-Type: application/json" \
  -d '{"name": "my_new_db", "description": "My custom knowledge base"}'
```

### Database Storage

All vector databases are stored under `CHROMA_DB_DIRECTORY` (default: `./resources/chroma_db/`):

```
resources/chroma_db/
├── tum_docs/
│   └── chroma.sqlite3
├── test3/
│   └── chroma.sqlite3
└── my_new_db/
    └── chroma.sqlite3
```

## Configuration

All settings can be configured via environment variables or `.env` file:

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `DEBUG` | `true` | Debug mode |

### Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen3:4b-instruct` | LLM model for chat |
| `OLLAMA_VISION_MODEL` | `granite3.2-vision:2b` | Vision model for image descriptions |
| `OLLAMA_TEMPERATURE` | `0.3` | LLM temperature |
| `OLLAMA_NUM_CTX` | `20000` | Context window size |
| `OLLAMA_REPEAT_PENALTY` | `1.15` | Repeat penalty |
| `OLLAMA_NUM_PREDICT` | `1000` | Max tokens to generate |
| `OLLAMA_KEEP_ALIVE` | `-1` | Keep model loaded (`-1` = forever) |

### Embedding & Retrieval

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `Snowflake/snowflake-arctic-embed-l-v2.0` | Embedding model |
| `EMBEDDING_DEVICE` | `auto` | Device (`cuda`, `mps`, or `cpu`) |
| `CHROMA_DB_DIRECTORY` | `./resources/chroma_db` | Base path for all vector databases |
| `CHROMA_PERSIST_DIRECTORY` | `./resources/chroma_db/test` | Default collection path |
| `CHROMA_COLLECTION_NAME` | `tum_docs` | Default collection name |

### RAG

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONTEXT_LENGTH` | `10000` | Max context length for RAG |
| `CHUNK_SIZE` | `600` | Document chunk size |
| `CHUNK_OVERLAP` | `300` | Chunk overlap |

### Reranking

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RERANKING` | `false` | Enable document reranking |
| `RERANKING_MODEL` | `jinaai/jina-reranker-v3` | Reranker model |
| `RERANKING_TOP_K` | `5` | Number of documents after reranking |

## Project Structure

```
backend/llm/
├── main.py                          # FastAPI app entry point
├── requirements.txt                 # Dependencies
├── Dockerfile                       # Container configuration
├── .env.example                     # Environment template
├── config/
│   ├── settings.py                  # Pydantic settings
│   ├── constants.py                 # Docling constants & enums
│   └── ingestion_config.json        # Ingestion configuration
├── models/
│   ├── llm_model.py                 # Ollama LLM manager
│   ├── vllm_model.py                # Vision LLM manager (Granite Vision)
│   ├── embedding_model.py           # Sentence Transformers manager
│   ├── reranker_model.py            # Jina Reranker manager
│   └── vectorstore.py              # ChromaDB multi-collection manager
├── services/
│   ├── startup_service.py           # Component initialization orchestration
│   ├── rag_chain_service.py         # RAG pipeline with streaming
│   ├── docling_service.py           # PDF/PPTX conversion with image classification
│   ├── feature_toggle_service.py    # Runtime database switching
│   └── image_storage_service.py     # Image lifecycle management
├── controllers/
│   ├── chat_controller.py           # Chat request handling
│   └── ingestion_controller.py      # Document ingestion orchestration
├── routes/
│   ├── chat_routes.py               # Chat API endpoints
│   ├── ingestion_routes.py          # Ingestion API endpoints
│   └── feature_toggle_routes.py     # Config API endpoints
├── resources/
│   └── pictures/                    # Permanent ingested images
└── static/
    └── images/                      # Temporary images for frontend editing
```

## Architecture

### RAG Pipeline

1. **Query** - User sends question via chat endpoint
2. **Embedding** - Query embedded using Snowflake Arctic Embed
3. **Retrieval** - Similar documents retrieved from ChromaDB (k=8)
4. **Reranking** - Optional reranking with Jina Reranker v3
5. **Context** - Retrieved docs formatted with source info and images
6. **Generation** - Context + question sent to Ollama LLM
7. **Streaming** - Response streamed back as Server-Sent Events

### Document Ingestion Pipeline

1. **Upload** - Frontend uploads PDF/PPTX file
2. **Conversion** - Docling converts to structured JSON with image classification
3. **Editing** - Frontend allows manual editing of extracted content
4. **Chunking** - Documents chunked (configurable size/overlap)
5. **Embedding** - Chunks embedded using Sentence Transformers
6. **Storage** - Embeddings stored in ChromaDB, images in permanent storage

## Docker

```bash
docker build -t atoss-llm .
docker run -p 8000:8000 atoss-llm
```

## Troubleshooting

1. **Ollama not running** - Start with `ollama serve`
2. **CUDA not available** - Set `EMBEDDING_DEVICE=cpu` in `.env`
3. **Model not found** - Pull required models: `ollama pull qwen3:4b-instruct`
4. **Port in use** - Change `PORT` in `.env` or kill existing process

## License

Internal use only - ATOSS Software AG
