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
     │ 1. Lifespan     │                    │                    │                   │                 │              │
     │    startup      │                    │                    │                   │                 │              │
     │────────┐        │                    │                    │                   │                 │              │
     │        │        │                    │                    │                   │                 │              │
     │<───────┘        │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │ 2. initialize_all()                  │                    │                   │                 │              │
     │────────────────>│                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 3. Load embeddings │                    │                   │                 │              │
     │                 │    (15%)           │                    │                   │                 │              │
     │                 │───────────────────>│                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │                    │ Load Qwen 3        │                   │                 │              │
     │                 │                    │ Embedding 0.6B     │                   │                 │              │
     │                 │                    │─────────┐          │                   │                 │              │
     │                 │                    │         │          │                   │                 │              │
     │                 │                    │<────────┘          │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │    Embeddings ready│                    │                   │                 │              │
     │                 │<───────────────────│                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 4. Load vectorstore│                    │                   │                 │              │
     │                 │    (30%)           │                    │                   │                 │              │
     │                 │───────────────────────────────────────> │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │ Load ChromaDB    │                 │              │
     │                 │                    │                    │ ASES_Referenzhandbuch              │              │
     │                 │                    │                    │─────────┐         │                 │              │
     │                 │                    │                    │         │         │                 │              │
     │                 │                    │                    │<────────┘         │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │    VectorStore ready                    │                   │                 │              │
     │                 │<─────────────────────────────────────── │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 5. Load LLM (45%)  │                    │                   │                 │              │
     │                 │─────────────────────────────────────────────────────────── >│                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │ Connect to      │              │
     │                 │                    │                    │                   │ Ollama          │              │
     │                 │                    │                    │                   │ (qwen3:1.7b)    │              │
     │                 │                    │                    │                   │───────┐         │              │
     │                 │                    │                    │                   │       │         │              │
     │                 │                    │                    │                   │<──────┘         │              │
     │                 │                    │                    │                   │                 │              │
     │                 │    LLM ready       │                    │                   │                 │              │
     │                 │<─────────────────────────────────────────────────────────── │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 6. Load reranker   │                    │                   │                 │              │
     │                 │    (60%)           │                    │                   │                 │              │
     │                 │────────────────────────────────────────────────────────────────────────────> │              │
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │ Load Jina    │
     │                 │                    │                    │                   │                 │ Reranker v3  │
     │                 │                    │                    │                   │                 │──────┐       │
     │                 │                    │                    │                   │                 │      │       │
     │                 │                    │                    │                   │                 │<─────┘       │
     │                 │                    │                    │                   │                 │              │
     │                 │    Reranker ready  │                    │                   │                 │              │
     │                 │<──────────────────────────────────────────────────────────────────────────── │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 7. Load retriever  │                    │                   │                 │              │
     │                 │    (80%)           │                    │                   │                 │              │
     │                 │────────────┐       │                    │                   │                 │              │
     │                 │            │ Create ContextualCompressionRetriever          │                 │              │
     │                 │<───────────┘       │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │                 │ 8. Init RAG chain  │                    │                   │                 │              │
     │                 │    (100%)          │                    │                   │                 │              │
     │                 │────────────────────────────────────────────────────────────────────────────────────────────>│
     │                 │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │ Init
     │                 │                    │                    │                   │                 │              │─────┐
     │                 │                    │                    │                   │                 │              │     │
     │                 │                    │                    │                   │                 │              │<────┘
     │                 │                    │                    │                   │                 │              │
     │                 │    RAG chain ready │                    │                   │                 │              │
     │                 │<────────────────────────────────────────────────────────────────────────────────────────────│
     │                 │                    │                    │                   │                 │              │
     │ 9. All ready    │                    │                    │                   │                 │              │
     │<────────────────│                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
     │ 10. Server ready│                    │                    │                   │                 │              │
     │    on port 8000 │                    │                    │                   │                 │              │
     │────────┐        │                    │                    │                   │                 │              │
     │        │        │                    │                    │                   │                 │              │
     │<───────┘        │                    │                    │                   │                 │              │
     │                 │                    │                    │                   │                 │              │
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

### Step 3: Load Embedding Model (15%)
```python
embedding_manager.load()
# Loads: Qwen/Qwen3-Embedding-0.6B (GPU/CUDA)
# Warms up with test embedding
# Uses SentenceTransformer with cosine similarity
```

### Step 4: Load Vector Store (30%)
```python
vectorstore_manager.load()
# Loads ChromaDB from ./Chroma_ASES_Referenzhandbuch_db2
# Collection: ASES_Referenzhandbuch
# Uses QueryOnlyEmbeddings wrapper for LangChain compatibility
```

### Step 5: Load LLM (45%)
```python
llm_manager.load()
# Connects to Ollama at http://localhost:11434
# Loads qwen3:1.7b model
# Configuration:
#   - temperature: 0.6
#   - top_p: 0.8
#   - num_ctx: 4096
#   - repeat_penalty: 1.2
#   - num_predict: 1024
```

### Step 6: Load Reranker (60%)
```python
reranker_manager.load()
# Loads jinaai/jina-reranker-v3 from HuggingFace
# Uses transformers AutoModel with trust_remote_code=True
# Creates JinaRerankerCompressor for LangChain integration
```

### Step 7: Load Retriever (80%)
```python
retriever_service.load()
# Creates base retriever from vectorstore (k=16)
# Wraps with ContextualCompressionRetriever
# Uses JinaRerankerCompressor for reranking (top_k=5)
```

### Step 8: Initialize RAG Chain (100%)
```python
rag_chain_service.initialize()
# Verifies all dependencies loaded
# Initializes German RAG prompt template
# Marks service as ready
```

### Step 9-10: Server Ready
Server starts accepting requests on `http://localhost:8000`.

---

## 2. Streaming Response Flow

This diagram shows the sequence of events when a user sends a message and receives a streaming response.

```
┌──────────┐     ┌────────────┐     ┌───────────┐     ┌───────────┐     ┌─────────┐     ┌────────┐
│ Frontend │     │ Node.js    │     │ FastAPI   │     │ Retriever │     │RAG Chain│     │ Ollama │
│          │     │ Proxy      │     │ Controller│     │ Service   │     │ Service │     │        │
└────┬─────┘     └─────┬──────┘     └─────┬─────┘     └─────┬─────┘     └────┬────┘     └───┬────┘
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
     │                 │                  │                 │ (Qwen3-Embedding)             │
     │                 │                  │                 │ Search ChromaDB│              │
     │                 │                  │                 │ (k=16)         │              │
     │                 │                  │                 │ Rerank (Jina)  │              │
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

## Step-by-Step Explanation (Streaming)

### Step 1: Frontend EventSource Connection
Frontend connects via EventSource to Node.js proxy endpoint.

```javascript
const eventSource = new EventSource(
    `http://localhost:4004/api/conversations/${convId}/stream?query=${encodeURIComponent(message)}&history=${encodeURIComponent(JSON.stringify(history))}`
);
```

### Step 2: Node.js Proxies to FastAPI
Node.js conversation service forwards the request to FastAPI.

```javascript
const response = await axios({
    method: 'POST',
    url: 'http://localhost:8000/api/chat/stream',
    data: {
        message: query,
        conversation_id: conversationId,
        conversation_history: conversationHistory
    },
    responseType: 'stream'
});
response.data.pipe(res);
```

### Step 3: Validate Service Ready
Controller checks that all LLM components are loaded and ready.

```python
if not startup_service.is_loaded:
    raise RuntimeError("LLM service is not ready. Please wait for initialization.")
```

### Step 4-5: Document Retrieval with Reranking
```python
docs = await retriever_service.retrieve(question)
# 1. Embed query using Qwen 3 Embedding 0.6B
# 2. Search ChromaDB (retrieve k=16 docs)
# 3. Rerank using Jina Reranker v3
# 4. Return top 5 most relevant documents
```

### Step 6: Prepare RAG Prompt (German)
```python
context = self._format_docs(docs)
prompt_text = self._prompt.format(
    context=context,
    user_question=question,
    chat_history=chat_history
)
# Uses German RAG prompt template for ATOSS Workforce Management
```

### Step 7: Stream from Ollama
```python
llm = llm_manager.get_streaming_llm()
async for chunk in llm.astream(prompt_text):
    yield chunk.content
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
| POST | `/api/chat/generate` | Generate complete response (non-streaming) |
| POST | `/api/chat/stream` | Stream response via SSE |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `qwen3:1.7b` | LLM model name |
| `OLLAMA_TEMPERATURE` | `0.6` | Response randomness |
| `OLLAMA_TOP_P` | `0.8` | Nucleus sampling |
| `OLLAMA_NUM_CTX` | `4096` | Context window size |
| `OLLAMA_REPEAT_PENALTY` | `1.2` | Repetition penalty |
| `OLLAMA_NUM_PREDICT` | `1024` | Max tokens to generate |
| `EMBEDDING_MODEL` | `Qwen/Qwen3-Embedding-0.6B` | Embedding model |
| `EMBEDDING_DEVICE` | `cuda` | Device for embeddings (cuda/cpu) |
| `CHROMA_PERSIST_DIRECTORY` | `./Chroma_ASES_Referenzhandbuch_db2` | ChromaDB storage path |
| `CHROMA_COLLECTION_NAME` | `ASES_Referenzhandbuch` | ChromaDB collection name |
| `RERANKER_MODEL` | `jinaai/jina-reranker-v3` | Reranker model |
| `RERANKER_TOP_K` | `5` | Top K documents after reranking |
| `RETRIEVER_K` | `16` | Initial retrieval count |

---

## RAG Prompt Template

The system uses a German RAG prompt template optimized for ATOSS Workforce Management:

```
Du bist ein hilfreicher KI-Assistent für ATOSS Workforce Management Lösungen.
Deine Hauptaufgabe ist es, technische oder systemnahe Informationen aus dem internen Handbuch
so umzuformulieren, dass sie für **Mitarbeiter, Teamleiter oder Planer** leicht verständlich
und handlungsorientiert sind.

Nutze den folgenden Kontext, um die Frage des Benutzers zu beantworten. Der Kontext stammt
aus dem offiziellen ATOSS-Handbuch. Wenn du Informationen aus dem Kontext verwendest,
**zitiere die genaue Passage wörtlich** (als direktes Zitat), damit der Benutzer diese im
PDF-Manual nachprüfen kann.

[... additional instructions ...]
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
ollama pull qwen3:1.7b

# Start the server
python main.py
```

The server will start at `http://localhost:8000`.

---

## Component Dependencies

```
startup_service
    ├── embedding_manager (15%)
    │       └── SentenceTransformer (Qwen3-Embedding-0.6B)
    ├── vectorstore_manager (30%)
    │       └── ChromaDB (depends on embedding_manager)
    ├── llm_manager (45%)
    │       └── ChatOllama (qwen3:1.7b)
    ├── reranker_manager (60%)
    │       └── Jina Reranker v3
    ├── retriever_service (80%)
    │       └── ContextualCompressionRetriever (depends on vectorstore + reranker)
    └── rag_chain_service (100%)
            └── RAG Chain (depends on retriever + llm)
```
