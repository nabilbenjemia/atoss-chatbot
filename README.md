# ATOSS.GPT

An AI-powered chatbot for ATOSS Workforce Management documentation using RAG (Retrieval-Augmented Generation). Built as a microservices architecture with a React frontend, Node.js backend services, and a Python-based LLM server.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                         │
│                        Port 5173                                 │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   Auth   │ │   User   │ │  Conver- │ │ Learning │ │Ingestion │
│ Service  │ │ Service  │ │ sation   │ │ Material │ │ Service  │
│  :4003   │ │  :4001   │ │  :4004   │ │  :4005   │ │  :4006   │
└──────────┘ └──────────┘ └────┬─────┘ └──────────┘ └────┬─────┘
                               │                         │
                               ▼                         ▼
                         ┌──────────┐              ┌──────────┐
                         │   LLM    │◀────────────▶│  Ollama  │
                         │ Server   │              │  :11434  │
                         │  :8000   │              └──────────┘
                         └────┬─────┘
                              │
                         ┌────▼─────┐
                         │ ChromaDB │
                         │ (Vector) │
                         └──────────┘

        All Node.js services ──▶ MongoDB
```

## Prerequisites

- **Docker** & **Docker Compose** (recommended)
- Or for manual setup:
  - **Node.js** v18+
  - **Python** 3.11 or 3.12
  - **Ollama** running locally
  - **MongoDB** running locally

### Ollama Models

```bash
ollama pull qwen3:4b-instruct        # Chat LLM
ollama pull granite3.2-vision:2b      # Vision model (image descriptions)
```

---

## Quick Start (Docker)

Docker Compose profiles are available for different environments:

### macOS (Apple Silicon / Intel)

On macOS, the LLM service runs on your host machine for Metal GPU acceleration.

```bash
# Build and start core services
docker-compose --profile macos build
docker-compose --profile macos up -d

# Run LLM service manually on host (separate terminal)
cd backend/llm
source .venv/bin/activate
python main.py

# Make sure Ollama is running on host
ollama serve
```

### Windows/Linux with NVIDIA GPU

All services including Ollama run in Docker with CUDA acceleration.

**Prerequisites:** NVIDIA GPU, [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html), Docker with WSL2 (Windows) or Docker Engine (Linux).

```bash
docker-compose --profile gpu build
docker-compose --profile gpu up -d
```

### Docker Profile Summary

| Profile | LLM Location | GPU Support |
|---------|--------------|-------------|
| `macos` | Host machine | Metal (host) |
| `gpu` | Docker container | NVIDIA CUDA |

### Core Services (started with any profile)

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React UI served via nginx |
| Authentication | 4003 | User auth & API gateway |
| Conversation | 4004 | Chat management & analytics |
| User | 4001 | User profiles & preferences |
| Learning Material | 4005 | Video content management |

### Profile-Specific Services

| Service | `macos` | `gpu` |
|---------|---------|-------|
| Ingestion (4006) | Connects to `host.docker.internal:8000` | Connects to `llm:8000` |
| LLM (8000) | Run manually on host | In Docker |
| Ollama (11434) | Run manually on host | In Docker with GPU |

### Access the App

Open your browser: **http://localhost:5173**

---

## Manual Start (Development)

**Prerequisites:** MongoDB running (`mongod`), Ollama running (`ollama serve`), models pulled.

Start each service in a separate terminal:

### 1. LLM Server (Port 8000)

```bash
cd backend/llm
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 2. Authentication Service (Port 4003)

```bash
cd backend/authentication
npm install && npm run dev
```

### 3. User Service (Port 4001)

```bash
cd backend/user
npm install && npm run dev
```

### 4. Conversation Service (Port 4004)

```bash
cd backend/conversation
npm install && npm run dev
```

### 5. Learning Material Service (Port 4005)

```bash
cd backend/learning-material
npm install && npm run dev
```

### 6. Ingestion Service (Port 4006)

```bash
cd backend/ingestion
npm install && npm run dev
```

### 7. Frontend (Port 5173)

```bash
cd frontend
npm install && npm run dev
```

---

## Services Overview

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| Frontend | 5173 | React + Vite | Chat UI, ingestion workflow, analytics dashboard |
| Authentication | 4003 | Node.js/Express | JWT auth, registration, email verification, API gateway |
| User | 4001 | Node.js/Express | User profiles, preferences, profile pictures |
| Conversation | 4004 | Node.js/Express | Chat history, SSE streaming, query analytics |
| Learning Material | 4005 | Node.js/Express | Video upload, metadata, categories |
| Ingestion | 4006 | Node.js/Express | Document processing proxy to LLM service |
| LLM Server | 8000 | Python/FastAPI | RAG pipeline, Docling PDF/PPTX conversion, embeddings |
| Ollama | 11434 | Ollama | Local LLM inference engine |

---

## AI Strategy

**On-premise RAG system** — all data stays offline with no external API calls.

| Component | Model | Purpose |
|-----------|-------|---------|
| Chat LLM | `qwen3:4b-instruct` | German text generation for hospital queries |
| Vision LLM | `granite3.2-vision:2b` | Image understanding for document ingestion |
| Embeddings | `Snowflake/snowflake-arctic-embed-l-v2.0` | Multilingual document retrieval |
| Reranker | `jinaai/jina-reranker-v3` | Optional relevance reranking |
| Vector DB | ChromaDB | Persistent embedding storage |
| Doc Processing | Docling | PDF/PPTX parsing with image classification |

### RAG Pipeline

1. User sends question via chat
2. Query embedded with Snowflake Arctic Embed
3. Similar documents retrieved from ChromaDB (k=8)
4. Optional reranking with Jina Reranker
5. Context + question sent to Qwen LLM via Ollama
6. Response streamed back as Server-Sent Events

### Why Ollama?

- **Data Sovereignty** — operates entirely offline, all models run on-premise
- **Hardware Efficiency** — quantized models run on modest hardware
- **Easy Deployment** — eliminates complexity of raw model management

---

## API Endpoints

### Chat (LLM Server - Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/status` | Service status with component info |
| POST | `/api/chat/generate` | Generate complete response with sources |
| POST | `/api/chat/stream` | Stream response as SSE |

### Conversation (Port 4004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/user/:userId` | Get user conversations |
| GET | `/api/conversations/:id/stream` | Stream AI response (SSE) |
| POST | `/api/conversations/:id/messages/batch` | Save messages |
| PUT | `/api/conversations/:id` | Update conversation title |
| DELETE | `/api/conversations/:id` | Delete conversation |

### Analytics (Port 4004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Complete dashboard data |
| GET | `/api/analytics/keywords` | Keyword statistics |
| GET | `/api/analytics/categories` | Category statistics |
| GET | `/api/analytics/timeline` | Query timeline |
| GET | `/api/analytics/export` | Export queries as CSV |
| POST | `/api/analytics/process` | Process unanalyzed queries |

### Authentication (Port 4003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| POST | `/auth/refresh` | Refresh JWT token |
| GET | `/auth/verify` | Verify token |
| POST | `/auth/verify-email` | Email verification |
| POST | `/auth/logout` | Logout |

### User (Port 4001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |
| PATCH | `/users/me/username` | Update username |
| PATCH | `/users/me/preferences` | Update preferences (theme, language) |
| PATCH | `/users/me/profile-picture` | Upload profile picture |
| DELETE | `/users/me` | Delete account |
| POST | `/users/add-admin` | Promote user to admin |

### Ingestion (Port 4006)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ingestion/config` | Get strategies, helpers, collections |
| POST | `/api/ingestion/upload` | Upload PDF for extraction |
| POST | `/api/ingestion/preview` | Preview embeddings |
| POST | `/api/ingestion/ingest` | Ingest to vector database |
| POST | `/api/ingestion/collection` | Create ChromaDB collection |
| POST | `/api/ingestion/helper/image-descriptions` | AI image descriptions |

### Learning Material (Port 4005)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | List all videos |
| POST | `/api/videos` | Upload video |
| GET | `/api/videos/:id` | Get video details |
| DELETE | `/api/videos/:id` | Delete video |

---

## Environment Variables

### Backend LLM (`backend/llm/.env`)

```env
HOST=0.0.0.0
PORT=8000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b-instruct
OLLAMA_VISION_MODEL=granite3.2-vision:2b
OLLAMA_TEMPERATURE=0.3
OLLAMA_NUM_CTX=20000
OLLAMA_NUM_PREDICT=1000
OLLAMA_KEEP_ALIVE=-1
EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-l-v2.0
EMBEDDING_DEVICE=auto
CHROMA_DB_DIRECTORY=./resources/chroma_db
CHROMA_PERSIST_DIRECTORY=./resources/chroma_db/test
CHROMA_COLLECTION_NAME=tum_docs
MAX_CONTEXT_LENGTH=10000
CHUNK_SIZE=600
CHUNK_OVERLAP=300
ENABLE_RERANKING=false
RERANKING_MODEL=jinaai/jina-reranker-v3
RERANKING_TOP_K=5
```

### Backend Services (`backend/authentication/.env`, etc.)

```env
MONGODB_URI=mongodb://localhost:27017/atoss_gpt
JWT_SECRET=your-secret-key
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:4003
VITE_AUTH_LOGIN_URL=http://localhost:4003
VITE_USER_SERVICE_URL=http://localhost:4001
VITE_CONVERSATION_URL=http://localhost:4004
VITE_LEARNING_API_URL=http://localhost:4005
VITE_INGESTION_URL=http://localhost:4006
VITE_LLM_URL=http://localhost:8000
```

### Ingestion Service (`backend/ingestion/.env`)

```env
PORT=4006
LLM_SERVICE_URL=http://localhost:8000
```

---

## Project Structure

```
atoss.gpt/
├── frontend/                    # React + Vite SPA
├── backend/
│   ├── authentication/          # Auth & API gateway (Express)
│   ├── user/                    # User profiles (Express)
│   ├── conversation/            # Chat & analytics (Express)
│   ├── learning-material/       # Video content (Express)
│   ├── ingestion/               # Document processing proxy (Express)
│   └── llm/                     # RAG pipeline (FastAPI/Python)
├── docker-compose.yml           # Service orchestration
├── init-ollama.sh               # Ollama initialization script
└── README.md
```

See individual service READMEs for detailed documentation.

---

## License

Proprietary - ATOSS Software AG
