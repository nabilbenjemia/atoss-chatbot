# LLM Server

Python-based FastAPI server providing RAG (Retrieval-Augmented Generation) capabilities using Ollama, ChromaDB, and LangChain.

## Features

- 🤖 **Ollama LLM Integration** - Local LLM inference with streaming support
- 📚 **ChromaDB Vector Store** - Persistent document storage and similarity search
- 🔄 **Reranked Retrieval** - FlashRank reranking for improved retrieval quality
- 🔗 **LangChain Framework** - Modular RAG chain implementation
- ⚡ **Streaming Responses** - Real-time token-by-token response generation

## Prerequisites

- **Python 3.11 or 3.12** (3.13+ not yet supported due to ChromaDB/onnxruntime compatibility)
- [Ollama](https://ollama.ai/) installed and running locally
- CUDA-compatible GPU (optional, for faster embeddings)

> ⚠️ **Important**: Python 3.14 is NOT supported. ChromaDB requires `onnxruntime` which doesn't have wheels for Python 3.14 yet. Please use Python 3.11 or 3.12.

## Quick Start

### 1. Install Python 3.11 or 3.12 (if needed)

Download and install Python 3.11 or 3.12 from [python.org](https://www.python.org/downloads/)

### 2. Create Virtual Environment

```powershell
# Navigate to the LLM server directory
cd backend/llm

# Create virtual environment (use Python 3.11 or 3.12)
# Option 1: If python points to 3.11/3.12
python -m venv venv

# Option 2: Use py launcher with specific version
py -3.11 -m venv venv
# or
py -3.12 -m venv venv

# Option 3: Use full path to Python executable
"C:\Users\liyan\AppData\Local\Python\pythoncore-3.12-64\python.exe" -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# For Windows Command Prompt use:
# .\venv\Scripts\activate.bat

# For Linux/Mac use:
# source venv/bin/activate
```

### 3. Install Dependencies

```powershell
# Install all required packages
pip install -r requirements.txt
```

### 4. Configure Environment

```powershell
# Copy the example environment file
Copy-Item .env.example .env

# Edit .env file with your settings (optional)
# Default settings work with local Ollama installation
```

### 5. Pull Ollama Model

```powershell
# Make sure Ollama is running, then pull the model
ollama pull llama3.2
```

### 6. Start the Server

```powershell
# Start the server in development mode
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or simply run:
python main.py
```

The server will start at `http://localhost:8000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/stream` | POST | Stream chat response (SSE) |
| `/api/chat/generate` | POST | Generate complete response |
| `/api/chat/status` | GET | Check server status |
| `/api/config/switch-db` | POST | Switch active vector database |
| `/api/config/current-db` | GET | Get current database info |
| `/api/config/available-dbs` | GET | List available databases |
| `/api/ingestion/collection` | POST | Create new vector database |
| `/health` | GET | Health check endpoint |
| `/docs` | GET | Swagger API documentation |

## Vector Database Management

The LLM server supports multiple ChromaDB vector databases. You can switch between databases at runtime without restarting the server.

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
    {"name": "test3", "active": false},
    {"name": "production", "active": false}
  ],
  "count": 3,
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

### Switch to a Different Database

```bash
curl -X POST http://localhost:8000/api/config/switch-db \
  -H "Content-Type: application/json" \
  -d '{"dbName": "test3"}'
```

Response:
```json
{
  "success": true,
  "dbName": "test3",
  "documentCount": 42,
  "message": "Switched to 'test3' with 42 documents"
}
```

**Security Notes:**
- Database names must be alphanumeric with underscores/hyphens only
- Rate limited to one switch per 5 seconds
- Path traversal attempts are blocked

### Create a New Database

```bash
curl -X POST http://localhost:8000/api/ingestion/collection \
  -H "Content-Type: application/json" \
  -d '{"collectionId": "my_new_db", "description": "My custom knowledge base"}'
```

Response:
```json
{
  "success": true,
  "collectionId": "my_new_db",
  "message": "Collection 'my_new_db' created successfully"
}
```

### Database Storage Location

All vector databases are stored under the `CHROMA_DB_DIRECTORY` path (default: `./resources/chroma_db/`):

```
resources/chroma_db/
├── tum_docs/           # Default database
│   └── chroma.sqlite3
├── test3/              # Another database
│   └── chroma.sqlite3
└── my_new_db/          # Newly created
    └── chroma.sqlite3
```

## Configuration

All settings can be configured via environment variables or `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | LLM model name |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `EMBEDDING_DEVICE` | `cuda` | Device for embeddings (`cpu` or `cuda`) |
| `CHROMA_PERSIST_DIRECTORY` | `./data/chroma_db` | ChromaDB storage path |
| `RERANKER_MODEL` | `ms-marco-MiniLM-L-12-v2` | Reranker model |

## Project Structure

```
backend/llm/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Example environment configuration
├── config/
│   └── settings.py        # Pydantic settings management
├── models/
│   ├── embedding_model.py # HuggingFace embeddings manager
│   ├── vectorstore.py     # ChromaDB vector store manager
│   └── llm_model.py       # Ollama LLM manager
├── services/
│   ├── startup_service.py # Server initialization orchestration
│   ├── retriever_service.py # Reranked retrieval service
│   └── rag_chain_service.py # RAG chain for Q&A
├── controllers/
│   └── chat_controller.py # Chat request handling
└── routes/
    └── chat_routes.py     # API route definitions
```

## Development

### Running in Development Mode

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start with auto-reload
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Testing the API

```powershell
# Check server status
curl http://localhost:8000/api/chat/status

# Send a chat message
curl -X POST http://localhost:8000/api/chat/generate `
  -H "Content-Type: application/json" `
  -d '{"message": "Hello, how can you help me?"}'
```

## Troubleshooting

### Common Issues

1. **Ollama not running**
   ```powershell
   # Start Ollama service
   ollama serve
   ```

2. **CUDA not available**
   - Set `EMBEDDING_DEVICE=cpu` in `.env` file

3. **Model not found**
   ```powershell
   # Pull the required model
   ollama pull llama3.2
   ```

4. **Port already in use**
   - Change `PORT` in `.env` file or kill the existing process

## License

Internal use only - ATOSS Software AG
