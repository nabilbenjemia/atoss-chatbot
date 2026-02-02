# ATOSS.GPT - Copilot Instructions

## Current Development Focus

**Task**: Implementing backend functionality to match frontend API contracts for the Ingestion Page.

**Reference**: `doc/ingestion/API_CONTRACTS.md` defines all endpoints and expected request/response formats.

**Status**: Frontend is complete with mock data. Backend needs real implementations for:
- `POST /api/ingestion/convert` → Call LLM service `/api/docling/process`
- `POST /api/ingestion/ingest` → Call LLM service `/api/ingest`
- `POST /api/ingestion/collection` → Create new ChromaDB collection
- `POST /api/ingestion/helper/image-descriptions` → Call LLM service for AI vision

## Architecture Overview

This is a RAG-based chatbot with 5 microservices communicating via REST/SSE:

```
Frontend (React/Vite:5173) → Conversation Service (Node:4004) → LLM Service (FastAPI:8000) → Ollama:11434
                          ↘ Authentication Service (Node:4003)
                          ↘ Ingestion Service (Node:4005) → LLM Service (FastAPI:8000)
```

- **Frontend**: React 19 + Vite, Tailwind CSS, react-markdown for AI responses
- **Conversation Service**: Express.js, proxies SSE streams from LLM to frontend
- **Authentication Service**: Express.js, JWT auth, email verification
- **Ingestion Service**: Express.js, document upload/processing, vector DB ingestion
- **LLM Service**: FastAPI, RAG with ChromaDB + Snowflake embeddings + Ollama

## Quick Start

```bash
# Full stack (Docker)
docker-compose up -d

# Manual development - run in separate terminals:
cd backend/llm && source .venv/bin/activate && python main.py      # Port 8000
cd backend/authentication && npm run dev                            # Port 4003
cd backend/conversation && npm run dev                              # Port 4004
cd backend/ingestion && npm run dev                                 # Port 4005
cd frontend && npm run dev                                          # Port 5173
```

## Key Patterns

### Streaming Chat Flow
Messages stream via SSE: `ChatbotPage.jsx` → `conversationController.js:streamMessage()` → LLM `/api/chat/stream`
- Frontend uses `EventSource` with `eventSourceRef` for interrupt support
- Messages saved in batch after stream completes via `/messages/batch` endpoint
- See `doc/FLOW_SEND_MESSAGE.md` for complete sequence diagram

### Document Ingestion Flow
Upload → Process → Edit → Preview → Ingest: `IngestionPage.jsx` → `ingestionApi.js` → Ingestion Service → LLM Service
- File upload with multer, content extraction via LLM service
- Command Pattern for undo/redo (memory efficient)
- LocalStorage caching for session recovery
- See `doc/ingestion/API_CONTRACTS.md` for endpoint specifications
- See `doc/ingestion/FEATURE_INGESTION_PAGE.md` for complete documentation

### Ingestion API Endpoints (Port 4005 → Proxy to 8000)
| Endpoint | Status | LLM Proxy Target |
|----------|--------|------------------|
| `GET /api/ingestion/config` | ✅ Implemented | Fetches from `/api/ingestion/config` + local config |
| `POST /api/ingestion/convert` | ✅ Mock → TODO | `/api/ingestion/convert` |
| `POST /api/ingestion/preview` | ⚠️ Partial | Local logic |
| `POST /api/ingestion/ingest` | ✅ Mock → TODO | `/api/ingestion/ingest` |
| `GET /api/ingestion/collections` | TODO | `/api/ingestion/collections` |
| `POST /api/ingestion/collection` | TODO | `/api/ingestion/collection` |
| `POST /api/ingestion/helper/:id` | ✅ Mock → TODO | `/api/ingestion/helper/:id` |
| `POST /api/ingestion/strategy/:id` | TODO | `/api/ingestion/strategy/:id` |

### LLM Service Ingestion Endpoints (Port 8000)
| Endpoint | Status | Purpose |
|----------|--------|---------|
| `GET /api/ingestion/config` | ✅ Implemented | Remote strategies, helpers, collections |
| `GET /api/ingestion/collections` | ✅ Mock | List ChromaDB collections |
| `POST /api/ingestion/collection` | ✅ Mock | Create ChromaDB collection |
| `POST /api/ingestion/convert` | ✅ Mock | Docling document conversion |
| `POST /api/ingestion/ingest` | ✅ Mock | Store embeddings in ChromaDB |
| `POST /api/ingestion/helper/:id` | ✅ Mock | Run remote AI helper |
| `POST /api/ingestion/strategy/:id` | ✅ Mock | Run remote AI strategy |

### Ingestion Config Files
| File | Location | Purpose |
|------|----------|---------|
| `pictureClassifications.json` | `backend/ingestion/config/` | Docling's 26 picture classes, categories, presets |
| `backendServices.json` | `backend/ingestion/config/` | Local strategies and helpers only |
| `ingestion_config.json` | `backend/llm/config/` | Remote strategies, helpers, embedding models |

### Frontend State Management
- Chat state in `ChatbotPage.jsx`: `conversationId`, `messages`, `isStreaming`, `streamingMessage`
- Ingestion state in `IngestionPage.jsx`: `uploadQueue`, `documentState`, `contentType`
- Theme preference stored in user profile (API) and `localStorage`
- Auth tokens in `localStorage`: `auth_token`, `refresh_token`, `user`

### Environment Variables
Frontend uses Vite env vars (`import.meta.env.VITE_*`):
- `VITE_API_BASE_URL` → Authentication (default: `localhost:4003`)
- `VITE_CONVERSATION_URL` → Conversation service (default: `localhost:4004`)
- `VITE_INGESTION_URL` → Ingestion service (default: `localhost:4005`)
- `VITE_IMAGE_BASE_URL` → LLM static files (default: `localhost:8000/`)

Backend LLM settings in `backend/llm/config/settings.py` via `.env`:
- `OLLAMA_MODEL` (default: `qwen3:4b-instruct`)
- `EMBEDDING_MODEL` (default: `Snowflake/snowflake-arctic-embed-l-v2.0`)
- `CHROMA_PERSIST_DIRECTORY`, `ENABLE_RERANKING`

### RAG Pipeline
1. **Ingestion**: `backend/ingestion/` service handles upload → `backend/llm/` for processing → ChromaDB
2. **Retrieval**: `vectorstore_manager.search()` → optional reranking → `rag_chain_service`
3. **Generation**: Context + chat history → Ollama → streamed response

### Component Patterns
- Singleton managers in LLM service: `embedding_manager`, `vectorstore_manager`, `llm_manager`
- Controllers follow `{name}Controller.js` / `{name}_controller.py` pattern
- MongoDB models use Mongoose schemas in `models/` directories

## File Structure Reference

| Pattern | Location |
|---------|----------|
| React pages | `frontend/src/pages/` |
| React components | `frontend/src/components/` |
| API service layer | `frontend/src/services/api.js`, `ingestionApi.js` |
| Feature documentation | `doc/FEATURE_*.md`, `doc/FLOW_*.md` |
| Ingestion API contracts | `doc/ingestion/API_CONTRACTS.md` |
| Ingestion components | `frontend/src/components/ingestion/` |
| Ingestion backend | `backend/ingestion/` |
| LLM model managers | `backend/llm/models/` |

## Backend Implementation Files
When implementing real LLM service calls, edit these files:
- `backend/ingestion/services/ingestionService.js` - Upload, ingest operations
- `backend/ingestion/services/contentViewerService.js` - AI helpers (image descriptions)
- `backend/ingestion/controllers/ingestionController.js` - Request handlers

## Testing
- No test framework currently configured for backend services
- Frontend has Storybook stories in `frontend/tests/` (e.g., `AIMessage.stories.jsx`)

## Important Constraints

- **Python version**: Use 3.11 or 3.12 (ChromaDB/onnxruntime incompatible with 3.13+)
- **Docker networking**: Services use `http://llm:8000` internally, `localhost:8000` externally
- **AI responses**: Rendered via `react-markdown` + `remark-gfm` in `AIMessage.jsx`
- **Image handling**: Supports MongoDB refs (`mongodb:<uuid>`), relative paths, and URLs
