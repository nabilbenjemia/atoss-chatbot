# ATOSS.GPT - Copilot Instructions

## Architecture Overview

This is a RAG-based chatbot with 4 microservices communicating via REST/SSE:

```
Frontend (React/Vite:5173) → Conversation Service (Node:4004) → LLM Service (FastAPI:8000) → Ollama:11434
                          ↘ Authentication Service (Node:4003)
```

- **Frontend**: React 19 + Vite, Tailwind CSS, react-markdown for AI responses
- **Conversation Service**: Express.js, proxies SSE streams from LLM to frontend
- **Authentication Service**: Express.js, JWT auth, email verification
- **LLM Service**: FastAPI, RAG with ChromaDB + Snowflake embeddings + Ollama

## Quick Start

```bash
# Full stack (Docker)
docker-compose up -d

# Manual development - run in separate terminals:
cd backend/llm && source .venv/bin/activate && python main.py      # Port 8000
cd backend/authentication && npm run dev                            # Port 4003
cd backend/conversation && npm run dev                              # Port 4004
cd frontend && npm run dev                                          # Port 5173
```

## Key Patterns

### Streaming Chat Flow
Messages stream via SSE: `ChatbotPage.jsx` → `conversationController.js:streamMessage()` → LLM `/api/chat/stream`
- Frontend uses `EventSource` with `eventSourceRef` for interrupt support
- Messages saved in batch after stream completes via `/messages/batch` endpoint
- See `doc/FLOW_SEND_MESSAGE.md` for complete sequence diagram

### Frontend State Management
- Chat state in `ChatbotPage.jsx`: `conversationId`, `messages`, `isStreaming`, `streamingMessage`
- Theme preference stored in user profile (API) and `localStorage`
- Auth tokens in `localStorage`: `auth_token`, `refresh_token`, `user`

### Environment Variables
Frontend uses Vite env vars (`import.meta.env.VITE_*`):
- `VITE_API_BASE_URL` → Authentication (default: `localhost:4003`)
- `VITE_CONVERSATION_URL` → Conversation service (default: `localhost:4004`)
- `VITE_IMAGE_BASE_URL` → LLM static files (default: `localhost:8000/`)

Backend LLM settings in `backend/llm/config/settings.py` via `.env`:
- `OLLAMA_MODEL` (default: `qwen3:4b-instruct`)
- `EMBEDDING_MODEL` (default: `Snowflake/snowflake-arctic-embed-l-v2.0`)
- `CHROMA_PERSIST_DIRECTORY`, `ENABLE_RERANKING`

### RAG Pipeline
1. **Ingestion**: `backend/llm/benchmark/ingest.py` - PDF → chunks → ChromaDB
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
| API service layer | `frontend/src/services/api.js` |
| Feature documentation | `doc/FEATURE_*.md`, `doc/FLOW_*.md` |
| Ingestion components | `frontend/src/components/ingestion/` |
| LLM model managers | `backend/llm/models/` |

## Testing
- No test framework currently configured for backend services
- Frontend has Storybook stories in `frontend/tests/` (e.g., `AIMessage.stories.jsx`)

## Important Constraints

- **Python version**: Use 3.11 or 3.12 (ChromaDB/onnxruntime incompatible with 3.13+)
- **Docker networking**: Services use `http://llm:8000` internally, `localhost:8000` externally
- **AI responses**: Rendered via `react-markdown` + `remark-gfm` in `AIMessage.jsx`
- **Image handling**: Supports MongoDB refs (`mongodb:<uuid>`), relative paths, and URLs
