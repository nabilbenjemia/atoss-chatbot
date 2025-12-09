# Flow Diagram: LLM Server

This document describes the flow diagrams for the LLM Server, including the server startup sequence and the streaming response flow.

---

## 1. Server Startup Flow

This diagram shows the sequence of events when the LLM server starts up and loads all necessary components.

```
┌─────────┐     ┌─────────────┐     ┌───────────────┐     ┌──────────────┐     ┌───────────┐     ┌────────┐
│ FastAPI │     │  Startup    │     │   Embedding   │     │  VectorStore │     │    LLM    │     │  RAG   │
│  Main   │     │  Service    │     │    Manager    │     │   Manager    │     │  Manager  │     │ Chain  │
└────┬────┘     └──────┬──────┘     └───────┬───────┘     └──────┬───────┘     └─────┬─────┘     └───┬────┘
     │                 │                    │                    │                   │               │
     │ 1. Lifespan     │                    │                    │                   │               │
     │    startup      │                    │                    │                   │               │
     │────────┐        │                    │                    │                   │               │
     │        │        │                    │                    │                   │               │
     │<───────┘        │                    │                    │                   │               │
     │                 │                    │                    │                   │               │
     │ 2. initialize_all()                  │                    │                   │               │
     │────────────────>│                    │                    │                   │               │
     │                 │                    │                    │                   │               │
     │                 │ 3. Load embeddings │                    │                   │               │
     │                 │    (20%)           │                    │                   │               │
     │                 │───────────────────>│                    │                   │               │
     │                 │                    │                    │                   │               │
     │                 │                    │ Load HuggingFace   │                   │               │
     │                 │                    │ all-MiniLM-L6-v2   │                   │               │
     │                 │                    │─────────┐          │                   │               │
     │                 │                    │         │          │                   │               │
     │                 │                    │<────────┘          │                   │               │
     │                 │                    │                    │                   │               │
     │                 │    Embeddings ready│                    │                   │               │
     │                 │<───────────────────│                    │                   │               │
     │                 │                    │                    │                   │               │
     │                 │ 4. Load vectorstore│                    │                   │               │
     │                 │    (40%)           │                    │                   │               │
     │                 │───────────────────────────────────────> │                   │               │
     │                 │                    │                    │                   │               │
     │                 │                    │                    │ Load/Create       │               │
     │                 │                    │                    │ ChromaDB          │               │
     │                 │                    │                    │─────────┐         │               │
     │                 │                    │                    │         │         │               │
     │                 │                    │                    │<────────┘         │               │
     │                 │                    │                    │                   │               │
     │                 │    VectorStore ready                    │                   │               │
     │                 │<─────────────────────────────────────── │                   │               │
     │                 │                    │                    │                   │               │
     │                 │ 5. Load LLM (60%)  │                    │                   │               │
     │                 │─────────────────────────────────────────────────────────── >│               │
     │                 │                    │                    │                   │               │
     │                 │                    │                    │                   │ Connect to    │
     │                 │                    │                    │                   │ Ollama        │
     │                 │                    │                    │                   │───────┐       │
     │                 │                    │                    │                   │       │       │
     │                 │                    │                    │                   │<──────┘       │
     │                 │                    │                    │                   │               │
     │                 │    LLM ready       │                    │                   │               │
     │                 │<─────────────────────────────────────────────────────────── │               │
     │                 │                    │                    │                   │               │
     │                 │ 6. Load retriever  │                    │                   │               │
     │                 │    (80%)           │                    │                   │               │
     │                 │────────────┐       │                    │                   │               │
     │                 │            │       │                    │                   │               │
     │                 │<───────────┘       │                    │                   │               │
     │                 │                    │                    │                   │               │
     │                 │ 7. Init RAG chain  │                    │                   │               │
     │                 │    (100%)          │                    │                   │               │
     │                 │───────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │               │
     │                 │                    │                    │                   │               │ Init
     │                 │                    │                    │                   │               │─────┐
     │                 │                    │                    │                   │               │     │
     │                 │                    │                    │                   │               │<────┘
     │                 │                    │                    │                   │               │
     │                 │    RAG chain ready │                    │                   │               │
     │                 │<───────────────────────────────────────────────────────────────────────────│
     │                 │                    │                    │                   │               │
     │ 8. All ready    │                    │                    │                   │               │
     │<────────────────│                    │                    │                   │               │
     │                 │                    │                    │                   │               │
     │ 9. Server ready │                    │                    │                   │               │
     │    on port 8000 │                    │                    │                   │               │
     │────────┐        │                    │                    │                   │               │
     │        │        │                    │                    │                   │               │
     │<───────┘        │                    │                    │                   │               │
     │                 │                    │                    │                   │               │
┌────┴────┐     ┌──────┴──────┐     ┌───────┴───────┐     ┌──────┴───────┐     ┌─────┴─────┐     ┌───┴────┐
│ FastAPI │     │  Startup    │     │   Embedding   │     │  VectorStore │     │    LLM    │     │  RAG   │
│  Main   │     │  Service    │     │    Manager    │     │   Manager    │     │  Manager  │     │ Chain  │
└─────────┘     └─────────────┘     └───────────────┘     └──────────────┘     └───────────┘     └────────┘
```

---

## Step-by-Step Explanation (Startup)

### Step 1-2: Lifespan Startup
FastAPI's lifespan context manager triggers `startup_service.initialize_all()` when the server starts.

```python
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    await startup_service.initialize_all(progress_callback=progress_callback)
    yield
    await startup_service.shutdown()
```

### Step 3: Load Embedding Model (20%)
```python
embedding_manager.load()
# Loads: sentence-transformers/all-MiniLM-L6-v2
# Warms up with test embedding
```

### Step 4: Load Vector Store (40%)
```python
vectorstore_manager.load()
# Loads ChromaDB from ./data/chroma_db
# Creates collection if it doesn't exist
```

### Step 5: Load LLM (60%)
```python
llm_manager.load()
# Connects to Ollama at http://localhost:11434
# Loads llama3.2 model
# Tests connection with simple query
```

### Step 6: Load Retriever (80%)
```python
retriever_service.load()
# Creates base retriever from vectorstore (k=10)
# Initializes FlashrankRerank compressor
# Creates ContextualCompressionRetriever (final k=3)
```

### Step 7: Initialize RAG Chain (100%)
```python
rag_chain_service.initialize()
# Verifies all dependencies loaded
# Initializes prompt template
# Marks service as ready
```

### Step 8-9: Server Ready
Server starts accepting requests on `http://localhost:8000`.

---

## 2. Streaming Response Flow

This diagram shows the sequence of events when a user sends a message and receives a streaming response.

```
┌──────────┐     ┌────────────┐     ┌───────────┐     ┌───────────┐     ┌─────────┐     ┌────────┐
│ Frontend │     │ ChatRoutes │     │ Controller│     │ Retriever │     │RAG Chain│     │ Ollama │
└────┬─────┘     └─────┬──────┘     └─────┬─────┘     └─────┬─────┘     └────┬────┘     └───┬────┘
     │                 │                  │                 │                │              │
     │ POST /api/chat/stream              │                 │                │              │
     │ {message, conversation_id}         │                 │                │              │
     │────────────────>│                  │                 │                │              │
     │                 │                  │                 │                │              │
     │                 │ 1. stream_chat() │                 │                │              │
     │                 │─────────────────>│                 │                │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 2. Validate     │                │              │
     │                 │                  │    service ready│                │              │
     │                 │                  │────────┐        │                │              │
     │                 │                  │        │        │                │              │
     │                 │                  │<───────┘        │                │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 3. retrieve()   │                │              │
     │                 │                  │────────────────>│                │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │ Embed query    │              │
     │                 │                  │                 │ Search ChromaDB│              │
     │                 │                  │                 │ Rerank results │              │
     │                 │                  │                 │───────┐        │              │
     │                 │                  │                 │       │        │              │
     │                 │                  │                 │<──────┘        │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 4. Top 3 docs   │                │              │
     │                 │                  │<────────────────│                │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 5. stream()     │                │              │
     │                 │                  │─────────────────────────────────>│              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │ 6. Format    │
     │                 │                  │                 │                │    prompt    │
     │                 │                  │                 │                │───────┐      │
     │                 │                  │                 │                │       │      │
     │                 │                  │                 │                │<──────┘      │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │ 7. astream() │
     │                 │                  │                 │                │─────────────>│
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   Token 1    │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 8. SSE: {"content": "token1"}      │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   Token 2    │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 9. SSE: {"content": "token2"}      │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   ...        │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 10. SSE: {"done": true}            │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │ 11. Display     │                  │                 │                │              │
     │     complete    │                  │                 │                │              │
     │────────┐        │                  │                 │                │              │
     │        │        │                  │                 │                │              │
     │<───────┘        │                  │                 │                │              │
     │                 │                  │                 │                │              │
┌────┴─────┐     ┌─────┴──────┐     ┌─────┴─────┐     ┌─────┴─────┐     ┌────┴────┐     ┌───┴────┐
│ Frontend │     │ ChatRoutes │     │ Controller│     │ Retriever │     │RAG Chain│     │ Ollama │
└──────────┘     └────────────┘     └───────────┘     └───────────┘     └─────────┘     └────────┘
```

---

## Step-by-Step Explanation (Streaming)

### Step 1: API Request
Frontend sends POST request to `/api/chat/stream` with SSE (Server-Sent Events) connection.

```javascript
const response = await fetch('http://localhost:8000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id })
});
```

### Step 2: Validate Service
Controller checks that all LLM components are loaded and ready.

```python
if not rag_chain_service.is_ready():
    raise HTTPException(status_code=503, detail="Service not ready")
```

### Step 3-4: Document Retrieval
```python
docs = await retriever_service.retrieve(question)
# 1. Embed query using embedding model
# 2. Search ChromaDB (retrieve k=10 docs)
# 3. Rerank using FlashrankRerank
# 4. Return top 3 most relevant documents
```

### Step 5-6: Prepare RAG Chain
```python
context = format_docs(docs)
prompt = RAG_PROMPT.format(context=context, question=question)
```

### Step 7: Stream from Ollama
```python
async for chunk in llm.astream(prompt):
    yield chunk.content
```

### Step 8-10: SSE Events
Each token is sent as an SSE event to the frontend:

```
data: {"content": "ATOSS"}
data: {"content": " is"}
data: {"content": " a"}
...
data: {"done": true}
```

### Step 11: Frontend Display
Frontend appends each token to the message display in real-time.

```javascript
const reader = response.body.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Parse and display each chunk
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info and available endpoints |
| GET | `/health` | Global health check |
| GET | `/api/chat/status` | Detailed status of all components |
| GET | `/api/chat/health` | Simple health check |
| POST | `/api/chat/generate` | Generate complete response |
| POST | `/api/chat/stream` | Stream response via SSE |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `llama3.2` | LLM model name |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `CHROMA_PERSIST_DIRECTORY` | `./data/chroma_db` | ChromaDB storage path |

---

## Running the Server

```powershell
# Navigate to the LLM server directory
cd backend/llm

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Ensure Ollama is running
ollama pull llama3.2

# Start the server
python main.py
```

The server will start at `http://localhost:8000`.
