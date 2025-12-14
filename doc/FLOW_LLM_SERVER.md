# Flow Diagram: LLM Server

This document describes the flow diagrams for the LLM Server, including the server startup sequence and the streaming response flow.

---

## 1. Server Startup Flow

This diagram shows the sequence of events when the LLM server starts up and loads all necessary components.

```
┌─────────┐     ┌─────────────┐     ┌───────────────┐     ┌──────────────┐     ┌───────────┐     ┌──────────┐     ┌────────┐
│ FastAPI │     │  Startup    │     │   Embedding   │     │  VectorStore │     │    LLM    │     │ Reranker │     │  RAG   │
│  Main   │     │  Service    │     │   Manager     │     │   Manager    │     │  Manager  │     │ Manager  │     │ Chain  │
└────┬────┘     └──────┬──────┘     └───────┬───────┘     └──────┬───────┘     └─────┬─────┘     └─────┬────┘     └───┬────┘
     │                 │                    │                    │                   │                 │              │
     │─────────────────>│                    │                    │                   │                 │              │
     │ lifespan start   │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 ├─ initialize_all() ─────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │ 1. Load embedding (25%)               │                   │                 │              │
     │                 ├────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │ Snowflake embedding loaded             │                 │              │
     │                 │                    │<─────────────────────────────────────────────────────────────────────── │
     │                 │                    │                    │                   │                 │              │
     │                 │ 2. Load vectorstore (50%)              │                   │                 │              │
     │                 ├─────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │ ChromaDB loaded   │                 │              │
     │                 │                    │                    │<─────────────────────────────────────────────────── │
     │                 │                    │                    │                   │                 │              │
     │                 │ 3. Load LLM (75%)  │                    │                   │                 │              │
     │                 ├────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │ Ollama connected│              │
     │                 │                    │                    │                   │<─────────────────────────────── │
     │                 │                    │                    │                   │                 │              │
     │                 │ 4. Load reranker (85%)                 │                   │                 │              │
     │                 ├─────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │ Cross-encoder│
     │                 │                    │                    │                   │                 │  loaded (opt)│
     │                 │                    │                    │                   │                 │<────────────── │
     │                 │                    │                    │                   │                 │              │
     │                 │ 5. Verify RAG (100%)                   │                   │                 │              │
     │                 ├────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │ All dependencies
     │                 │                    │                    │                   │                 │  verified     │
     │                 │                    │                    │                   │                 │<────────────── │
     │                 │                    │                    │                   │                 │              │
     │ All ready ✓     │                    │                    │                   │                 │              │
     │<────────────────┤                    │                    │                   │                 │              │
```

---

## Step-by-Step Explanation (Startup)

### Step 1: Lifespan Startup
FastAPI's lifespan context manager triggers `startup_service.initialize_all()` when the server starts.

```python
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    await startup_service.initialize_all(progress_callback=progress_callback)
    yield
    await startup_service.shutdown()
```

### Step 2: Load Embedding Model (25%)
```python
embedding_manager.load()
# Loads: Snowflake/snowflake-arctic-embed-l-v2.0
# Device: auto (CUDA > MPS > CPU)
# Uses SentenceTransformer with cosine similarity
# Warms up with test embedding
```

### Step 3: Load Vector Store (50%)
```python
vectorstore_manager.load()
# Loads ChromaDB from ./chroma_db_snowflake_600chunks_300overlapping
# Collection: tum_docs
# Uses native embedding_manager (no LangChain wrapper)
# Settings: CHUNK_SIZE=600, CHUNK_OVERLAP=300
```

### Step 4: Load LLM (75%)
```python
llm_manager.load()
# Connects to Ollama at http://localhost:11434
# Loads qwen2.5:7b-instruct-q4_0 model
# Configuration:
#   - temperature: 0.3 (balanced creativity)
#   - num_ctx: 5000 (context window)
#   - repeat_penalty: 1.2
#   - num_predict: 500 (max tokens)
```

### Step 5: Load Reranker (85%) - Optional
```python
reranker_manager.load()
# Loads cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 (if ENABLE_RERANKING=True)
# Multilingual cross-encoder for German medical documents
# Can be disabled via settings: ENABLE_RERANKING=False
# Device: auto (same as embedding model)
```

### Step 6: Initialize RAG Chain (100%)
```python
rag_chain_service.verify()
# Verifies all dependencies loaded successfully
# Sets service as ready for request handling
```

### Step 7: Server Ready
Server accepts requests on `http://localhost:8000`.

---

## 2. Streaming Response Flow

This diagram shows the sequence of events when a user sends a message and receives a streaming response.

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────┐     ┌────────┐
│ Frontend │     │ FastAPI  │     │ Vectorstore │     │  Reranker   │     │ RAG Chain   │     │  LLM   │     │ Ollama │
│          │     │Controller│     │  Manager   │     │  Manager    │     │  Service    │     │Manager │     │        │
└────┬─────┘     └─────┬────┘     └──────┬─────┘     └──────┬──────┘     └──────┬──────┘     └───┬────┘     └───┬────┘
     │                 │                  │                 │                │              │
     │ EventSource     │                  │                 │                │              │
     │ GET /:convId/stream?query=...      │                 │                │              │
     │────────────────>│                  │                 │                │              │
     │                 │                  │                 │                │              │
     │                 │ 1. POST /api/chat/stream           │                │              │
     │                 │   {message, conversation_id,       │                │              │
     │                 │    conversation_history}           │                │              │
     │                 │─────────────────>│                 │                │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 2. Validate     │                │              │
     │                 │                  │    service ready│                │              │
     │                 │                  │────────┐        │                │              │
     │                 │                  │        │        │                │              │
     │                 │                  │<───────┘        │                │              │
     │                 │                  │                 │                │              │
     │                 │                  │ 3. stream_response()             │              │
     │                 │                  │─────────────────────────────────>│              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │ 4. retrieve()│
     │                 │                  │                 │<───────────────│              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │ Embed query    │              │
     │                 │                  │                 │ (Snowflake)    │              │
     │                 │                  │                 │ Search ChromaDB│              │
     │                 │                  │                 │ (k=8)          │              │
     │                 │                  │                 │ Rerank         │              │
     │                 │                  │                 │ (cross-encoder)│              │
     │                 │                  │                 │ (top_k=5)      │              │
     │                 │                  │                 │───────┐        │              │
     │                 │                  │                 │       │        │              │
     │                 │                  │                 │<──────┘        │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │ 5. Reranked    │              │
     │                 │                  │                 │    documents   │              │
     │                 │                  │                 │───────────────>│              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │ 6. Format    │
     │                 │                  │                 │                │    context + │
     │                 │                  │                 │                │    German    │
     │                 │                  │                 │                │    prompt    │
     │                 │                  │                 │                │───────┐      │
     │                 │                  │                 │                │       │      │
     │                 │                  │                 │                │<──────┘      │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │ 7. llm.astream()
     │                 │                  │                 │                │─────────────>│
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   Token 1    │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 8. SSE: {"content": "Token1"}      │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   Token 2    │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 9. SSE: {"content": "Token2"}      │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │                 │                  │                 │                │   ...        │
     │                 │                  │                 │                │<─────────────│
     │                 │                  │                 │                │              │
     │                 │ 10. SSE: {"done": true}            │                │              │
     │<────────────────────────────────────────────────────────────────────── │              │
     │                 │                  │                 │                │              │
     │ 11. Close       │                  │                 │                │              │
     │     EventSource │                  │                 │                │              │
     │────────┐        │                  │                 │                │              │
     │        │        │                  │                 │                │              │
     │<───────┘        │                  │                 │                │              │
     │                 │                  │                 │                │              │
     │ 12. POST /:convId/messages/batch   │                 │                │              │
     │     {userMessage, aiMessage}       │                 │                │              │
     │────────────────>│                  │                 │                │              │
     │                 │                  │                 │                │              │
     │                 │ Save to MongoDB  │                 │                │              │
     │                 │───────┐          │                 │                │              │
     │                 │       │          │                 │                │              │
     │                 │<──────┘          │                 │                │              │
     │                 │                  │                 │                │              │
     │ 13. 201 OK      │                  │                 │                │              │
     │<────────────────│                  │                 │                │              │
     │                 │                  │                 │                │              │
```

---

## Step-by-Step Explanation (Streaming Response)

### Step 1: API Request
Frontend sends POST request to `/api/chat/stream` with EventSource or fetch.

```javascript
const response = await fetch('http://localhost:8000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        message: "Wie beantrage ich Urlaub?",
        conversation_history: []
    })
});
```

### Step 2: Validate Service
Controller checks that all LLM components are loaded and ready.

```python
if not startup_service.is_loaded:
    raise RuntimeError("LLM service is not ready. Please wait for initialization.")
```

### Step 3: Document Retrieval (k=8)
VectorStore searches ChromaDB using semantic similarity.

```python
docs = await vectorstore_manager.search(question, k=8)
# 1. Embed question using embedding_manager
# 2. Query ChromaDB with query_embeddings
# 3. Return 8 most similar documents
```

### Step 4: Rerank Documents (if enabled)
If `ENABLE_RERANKING=True`, cross-encoder reranks the 8 documents.

```python
if settings.ENABLE_RERANKING:
    docs = self._rerank_documents(question, docs)
    # 1. Create query-document pairs
    # 2. Get relevance scores from cross-encoder
    # 3. Keep top RERANKING_TOP_K=5 documents
```

### Step 5: Format Context
Retrieved documents are formatted into a context string with citations.

```python
context = self._format_docs(docs)
# Format: "--- Zitat aus: source (Page X) ---\n{content}\n\n"
```

### Step 6: Build RAG Prompt
Context and chat history are combined into the full prompt.

```python
full_context = CONTEXT_CHATBOT.format(
    context=context,
    chat_history=chat_history
)
```

### Step 7: Stream from Ollama
LLM streams response token-by-token.

```python
async for chunk in llm_manager.stream_generate(context, question):
    yield chunk  # Each token is yielded
```

### Step 8-10: SSE Events
Each token is sent as an SSE event through the chain:

```
data: {"content": "ATOSS"}
data: {"content": " ist"}
data: {"content": " ein"}
...
data: {"done": true}
```

### Step 11: Close EventSource
Frontend closes the EventSource connection after receiving `{"done": true}`.

### Step 12-13: Batch Save Messages
After streaming completes, frontend saves both user and AI messages via batch endpoint.

```javascript
await fetch(`/api/conversations/${convId}/messages/batch`, {
    method: 'POST',
    body: JSON.stringify({ userMessage, aiMessage, userId })
});
```


---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info and available endpoints |
| GET | `/health` | Global health check |
| GET | `/api/chat/status` | Detailed status of all components |
| GET | `/api/chat/health` | Simple health check |
| POST | `/api/chat/generate` | Generate complete response (non-streaming) |
| POST | `/api/chat/stream` | Stream response via SSE |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct-q4_0` | LLM model name |
| `OLLAMA_TEMPERATURE` | `0.3` | Response creativity (balanced) |
| `OLLAMA_NUM_CTX` | `5000` | Context window size |
| `OLLAMA_REPEAT_PENALTY` | `1.2` | Repetition penalty |
| `OLLAMA_NUM_PREDICT` | `500` | Max tokens to generate |
| `EMBEDDING_MODEL` | `Snowflake/snowflake-arctic-embed-l-v2.0` | Embedding model |
| `EMBEDDING_DEVICE` | `auto` | Device for embeddings (auto/cuda/cpu/mps) |
| `CHROMA_PERSIST_DIRECTORY` | `./chroma_db_snowflake_600chunks_300overlapping` | ChromaDB storage path |
| `CHROMA_COLLECTION_NAME` | `tum_docs` | ChromaDB collection name |
| `ENABLE_RERANKING` | `False` | Enable cross-encoder reranking |
| `RERANKING_MODEL` | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | Reranker model |
| `RERANKING_TOP_K` | `5` | Top K documents after reranking |




---

## System Response Guidelines

You are an expert support assistant for the TUM University Hospital.
Your task is to answer user questions accurately based on the provided documents and chat history.

### RULES:

1. **ANSWER IN GERMAN ONLY.**

2. **GROUND YOUR ANSWER** in the provided context - paraphrase if the user demands.

3. **FOLLOW STRICTLY ONE OF THESE TWO CASES:**

   **CASE A (Answer NOT found):** If the context does not contain enough information to answer, output EXACTLY this string and NOTHING else:
   ```
   Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de
   ```
   (STOP writing immediately after this sentence. Do NOT add any citations or page numbers in CASE A.)

   **CASE B (Answer found):** If the context contains the answer, provide a concise German answer first.
   Structure your response EXACTLY in this order:
   1. The Answer text.
   2. Two newlines.
   3. The Source at the very bottom.

   DO NOT start the answer with the source. The source must be the very last line.

   **Example format:**
   ```
   Example Answer
   
   [Quelle: Dateiname]
   ```

---

## Running the Server

```powershell
# Navigate to the LLM server directory
cd backend/llm

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Ensure Ollama is running with the model
ollama pull qwen2.5:7b-instruct-q4_0

# Start the server
python main.py
```

The server will start at `http://localhost:8000`.

---

## Component Dependencies

```
startup_service (manages initialization sequence)
    ├── embedding_manager (25%)
    │       └── SentenceTransformer (Snowflake embedding)
    ├── vectorstore_manager (50%)
    │       └── ChromaDB (depends on embedding_manager)
    ├── llm_manager (75%)
    │       └── AsyncClient (Ollama - qwen2.5:7b-instruct-q4_0)
    ├── reranker_manager (85%) - Optional
    │       └── CrossEncoder (cross-encoder/mmarco-mMiniLMv2-L12-H384-v1)
    └── rag_chain_service (100%)
            └── RAG Chain (depends on all managers)
```
