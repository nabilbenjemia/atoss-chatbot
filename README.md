
# ATOSS.GPT

An AI-powered chatbot for ATOSS Workforce Management documentation using RAG (Retrieval-Augmented Generation).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Conversation   │────▶│   LLM Server    │
│  (React/Vite)   │     │    Service      │     │   (FastAPI)     │
│   Port 5173     │     │   Port 4004     │     │   Port 8000     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Authentication  │
                        │    Service      │
                        │   Port 4003     │
                        └─────────────────┘
```

## Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **Ollama** running locally (`ollama serve` in background)
- **MongoDB** running locally
- **qwen2.5:7b-instruct-q4_0** model pulled and available in Ollama

### Install Ollama Model

```bash
ollama pull qwen2.5:7b-instruct-q4_0
```

---

## 🚀 Quick Start

**Prerequisites Check:**
- Ensure MongoDB is running: `mongod`
- Ensure Ollama is running in background: `ollama serve`

Open **4 terminal windows** and run each command:

### 1. LLM Server (Python - Port 8000)

```powershell
cd backend/llm
.\.venv\Scripts\Activate.ps1
python main.py
```

### 2. Authentication Service (Node.js - Port 4003)

```powershell
cd backend/authentication
npm start
```

### 3. Conversation Service (Node.js - Port 4004)

```powershell
cd backend/conversation
node index.js
```

### 4. Frontend (Vite - Port 5173)

```powershell
cd frontend
npm run dev
```

### 🌐 Access the App

Open your browser: **http://localhost:5173**

---

## Services Overview

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| Frontend | 5173 | React + Vite | User interface |
| Conversation | 4004 | Node.js/Express | Chat & message management |
| Authentication | 4003 | Node.js/Express | User auth & sessions |
| LLM Server | 8000 | Python/FastAPI | RAG + Ollama integration |

---

## Chatbot Strategy 

qwen2.5:7b-instruct-q4_0 (89% Accuracy, 3.8s latency). It is the most reliable model for understanding internal hospital queries

Snowflake/snowflake-arctic-embed-l-v2.0 will serve as the embedding model with the best result 

### AI Strategy

Implement a strictly on-premise Retrieval-Augmented Generation (RAG) system pairing Qwen 2.5 for German text generation with Snowflake Arctic Embed L v2.0 for high-precision document retrieval. This "dual-model" approach ensures that all hospital data remains offline while leveraging Snowflake's superior multilingual understanding to find the exact paragraph needed from handbooks before Qwen answers.


### Software Stack 

1. Engine Ollama
   * Run `ollama serve` in background
   * Pull model: `ollama pull qwen2.5:7b-instruct-q4_0`
   * SentenceTransformers for embeddings: `Snowflake/snowflake-arctic-embed-l-v2.0`

2. Vector Database 
   * ChromaDB (v0.4+) -> stores embeddings created by Snowflake model
   * Persistent storage at `./chroma_db_snowflake_600chunks_300overlapping`
   * PDF parsing with PyMuPDF for document ingestion

3. Frontend & Backend Services
   * React (Vite) frontend for user interface
   * Node.js/Express microservices (Authentication, Conversation)
   * FastAPI server for RAG pipeline

### Why Ollama?

* **Data Sovereignty**: Operates entirely offline - all models run on-premise
* **Hardware Efficiency**: Quantized models (q4_0) run efficiently on modest hardware
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
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_0
OLLAMA_TEMPERATURE=0.3
OLLAMA_NUM_CTX=5000
OLLAMA_NUM_PREDICT=500

# Embedding Configuration
EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-l-v2.0
EMBEDDING_DEVICE=auto

# ChromaDB Configuration
CHROMA_PERSIST_DIRECTORY=./chroma_db_snowflake_600chunks_300overlapping
CHROMA_COLLECTION_NAME=tum_docs
CHUNK_SIZE=600
CHUNK_OVERLAP=300

# RAG Configuration
MAX_CONTEXT_LENGTH=10000

# Reranking Configuration (Optional - improves relevance)
ENABLE_RERANKING=False
RERANKING_MODEL=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1
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

## Install Dependencies

```powershell
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
.\.venv\Scripts\Activate.ps1
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








