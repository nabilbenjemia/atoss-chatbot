
# ATOSS.GPT

An AI-powered chatbot for ATOSS Workforce Management documentation using RAG (Retrieval-Augmented Generation).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Conversation   │────▶│   LLM Server    │
│  (React/Vite)   │     │    Service      │     │   (FastAPI)     │
│   Port 5173     │     │   Port 4004     │     │   Port 8000     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Authentication  │     │     Ollama      │
                        │    Service      │     │   Port 11434    │
                        │   Port 4003     │     └─────────────────┘
                        └─────────────────┘
```

## Prerequisites

- **Docker** & **Docker Compose** (recommended)
- Or for manual setup:
  - **Node.js** v18+
  - **Python** 3.10+
  - **Ollama** running locally
  - **MongoDB** running locally

### Ollama Model

The project uses **qwen3:4b-instruct** as the default LLM model.

```bash
ollama pull qwen3:4b-instruct
```

---

## 🚀 Quick Start (Docker - Recommended)

The easiest way to run all services:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

This will automatically:
- Start MongoDB
- Start Ollama and pull the model
- Start all backend services (LLM, Authentication, Conversation)
- Start the frontend

### 🌐 Access the App

Open your browser: **http://localhost:5173**

---

## 🔧 Manual Start (Development)

If you prefer running services manually:

**Prerequisites Check:**
- Ensure MongoDB is running: `mongod`
- Ensure Ollama is running: `ollama serve`
- Pull the model: `ollama pull qwen3:4b-instruct`

Open **4 terminal windows** and run each command:

### 1. LLM Server (Python - Port 8000)

```bash
cd backend/llm
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

### 2. Authentication Service (Node.js - Port 4003)

```bash
cd backend/authentication
npm install
npm run dev
```

### 3. Conversation Service (Node.js - Port 4004)

```bash
cd backend/conversation
npm install
npm run dev
```

### 4. Frontend (Vite - Port 5173)

```bash
cd frontend
npm install
npm run dev
```

---

## Services Overview

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| Frontend | 5173 | React + Vite | User interface |
| Conversation | 4004 | Node.js/Express | Chat & message management |
| Authentication | 4003 | Node.js/Express | User auth & sessions |
| LLM Server | 8000 | Python/FastAPI | RAG + Ollama integration |
| Ollama | 11434 | Ollama | Local LLM inference |

---

## Chatbot Strategy 

**qwen3:4b-instruct** - Fast and efficient model for understanding internal hospital queries

**Snowflake/snowflake-arctic-embed-l-v2.0** - Embedding model with excellent multilingual support 

### AI Strategy

Implement a strictly on-premise Retrieval-Augmented Generation (RAG) system pairing Qwen 3 for German text generation with Snowflake Arctic Embed L v2.0 for high-precision document retrieval. This "dual-model" approach ensures that all hospital data remains offline while leveraging Snowflake's superior multilingual understanding to find the exact paragraph needed from handbooks before Qwen answers.


### Software Stack 

1. **LLM Engine: Ollama**
   * Default model: `qwen3:4b-instruct`
   * SentenceTransformers for embeddings: `Snowflake/snowflake-arctic-embed-l-v2.0`

2. **Vector Database: ChromaDB**
   * ChromaDB (v0.4+) stores embeddings created by Snowflake model
   * Persistent storage at `./chroma_db_merged`
   * PDF parsing with PyMuPDF for document ingestion

3. **Frontend & Backend Services**
   * React (Vite) frontend for user interface
   * Node.js/Express microservices (Authentication, Conversation)
   * FastAPI server for RAG pipeline

### Why Ollama?

* **Data Sovereignty**: Operates entirely offline - all models run on-premise
* **Hardware Efficiency**: Quantized models run efficiently on modest hardware
* **Easy Deployment**: Eliminates complexity of raw model management
* **Safety**: No data leaves your infrastructure

---

## Environment Variables

### Backend LLM (`backend/llm/.env`)

```env
# Server Configuration
HOST=0.0.0.0
PORT=8000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434  # Use http://ollama:11434 for Docker
OLLAMA_MODEL=qwen3:4b-instruct
OLLAMA_TEMPERATURE=0.3
OLLAMA_NUM_CTX=20000
OLLAMA_NUM_PREDICT=1000
OLLAMA_KEEP_ALIVE=-1

# Embedding Configuration
EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-l-v2.0
EMBEDDING_DEVICE=auto

# ChromaDB Configuration
CHROMA_PERSIST_DIRECTORY=./resources/chroma_db/chroma_db_merged
CHROMA_COLLECTION_NAME=tum_docs
CHUNK_SIZE=600
CHUNK_OVERLAP=300

# RAG Configuration
MAX_CONTEXT_LENGTH=10000

# Reranking Configuration (Optional - improves relevance)
ENABLE_RERANKING=False
RERANKING_MODEL=jinaai/jina-reranker-v3
RERANKING_TOP_K=5

# Debug Mode (Optional)
DEBUG=False
```

### Backend Services (`backend/authentication/.env`, `backend/conversation/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/atoss_gpt
JWT_SECRET=your-secret-key
```

---

## Docker Compose Services

The `docker-compose.yml` orchestrates all services:

| Service | Image/Build | Description |
|---------|-------------|-------------|
| frontend | `./frontend` | React app served via nginx |
| llm | `./backend/llm` | FastAPI RAG server |
| authentication | `./backend/authentication` | Auth microservice |
| conversation | `./backend/conversation` | Chat microservice |
| ollama | `ollama/ollama:latest` | Local LLM inference (GPU support) |

---

## Install Dependencies (Manual Setup)

```bash
# Frontend
cd frontend
npm install

# Authentication service
cd backend/authentication
npm install

# Conversation service
cd backend/conversation
npm install

# LLM service
cd backend/llm
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## API Endpoints

### Chat API (LLM Server - Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/stream` | Stream chat response (SSE) |
| POST | `/api/chat/generate` | Generate complete response |
| GET | `/api/chat/status` | Check service health |

### Conversation API (Port 4004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations/user/:userId` | Get user conversations |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/:id/stream` | Stream AI response |
| POST | `/api/conversations/:id/messages/batch` | Save messages |

---

## License

Proprietary - ATOSS Software AG
