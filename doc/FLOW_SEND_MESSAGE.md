# Flow Diagram: Send Message Button Click

This document describes the complete flow when a user types a message and clicks the "Send" button (or presses Enter) in the chatbox. **The streaming implementation is now complete.**

---

## Architecture Overview

The send message flow involves three services:
1. **Frontend (React)** - Port 5173
2. **Conversation Service (Node.js)** - Port 4004
3. **LLM Service (FastAPI)** - Port 8000

---

## Sequence Diagram (Streaming Flow)

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐
│  User   │    │ MessageInput │    │ ChatbotPage  │    │  Sidebar   │    │  Backend │    │ MongoDB │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └─────┬──────┘    └────┬─────┘    └────┬────┘
     │                │                   │                  │                │               │
     │ 1. Type message│                   │                  │                │               │
     │───────────────>│                   │                  │                │               │
     │                │                   │                  │                │               │
     │ 2. Click "Send"│                   │                  │                │               │
     │   or Enter key │                   │                  │                │               │
     │───────────────>│                   │                  │                │               │
     │                │                   │                  │                │               │
     │                │ 3. handleSend()   │                  │                │               │
     │                │──────────┐        │                  │                │               │
     │                │          │        │                  │                │               │
     │                │<─────────┘        │                  │                │               │
     │                │                   │                  │                │               │
     │                │ 4. onSendMessage  │                  │                │               │
     │                │   (messageText)   │                  │                │               │
     │                │──────────────────>│                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 5. Check if      │                │               │
     │                │                   │    conversationId│                │               │
     │                │                   │    exists        │                │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │   ┌────────────┴───────────────────┴──────────────────┴────────────────┴───────────────┤
     │   │ CASE A: No conversationId (New Conversation)                                       │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │                │                   │                  │                │               │
     │                │                   │ 6a. setIsStreaming(true)          │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 7a. POST /api/conversations       │               │
     │                │                   │      {userId}    │                │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ Create new    │
     │                │                   │                  │                │ Conversation  │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ Return convId │
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │ 8a. Return {_id: convId, ...}     │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 9a. setConversationId(convId)     │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 10a. fetchConversationTitles()    │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │                  │                │               │
     │                │                   │ (Updates sidebar)│                │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │   │ CASE B: conversationId exists (Existing Conversation)                              │
     │   │ Skip steps 6a-10a, use existing convId                                             │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │                │                   │                  │                │               │
     │                │                   │ 11. Create userMsg object         │               │
     │                │                   │     locally      │                │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 12. setMessages(prev => [...prev, userMsg])       │
     │                │                   │     (Optimistic UI update)        │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │ 13. User sees  │                   │                  │                │               │
     │     their msg  │                   │                  │                │               │
     │     instantly  │                   │                  │                │               │
     │<────────────────────────────────── │                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 14. POST /api/conversations/{convId}/messages     │
     │                │                   │     {userId, content, sender:'user'}              │
     │                │                   │─────────────────────────────────>│                │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 15. Validate  │
     │                │                   │                  │                │     convId    │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 16. If title  │
     │                │                   │                  │                │   "Untitled": │
     │                │                   │                  │                │   Update title│
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 17. Save user │
     │                │                   │                  │                │     message   │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 18. Generate  │
     │                │                   │                  │                │     AI reply  │
     │                │                   │                  │                │  (placeholder)│
     │                │                   │                  │                │─────────┐     │
     │                │                   │                  │                │         │     │
     │                │                   │                  │                │<────────┘     │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 19. Save AI   │
     │                │                   │                  │                │     message   │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │ 20. Return {aiMessage: {...}}     │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 21. setMessages(prev => [...prev, aiMessage])     │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │ 22. User sees  │                   │                  │                │               │
     │     AI reply   │                   │                  │                │               │
     │<────────────────────────────────── │                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 23. GET /api/conversations/user/{userId}          │
     │                │                   │     (Refresh titles)              │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 24. setConversationTitles(data)   │               │
     │                │                   │─────────────────>│                │               │
     │                │                   │                  │                │               │
     │ 25. Sidebar    │                   │                  │                │               │
     │     updated    │                   │                  │                │               │
     │<──────────────────────────────────────────────────────│                │               │
     │                │                   │                  │                │               │
┌────┴────┐    ┌──────┴───────┐    ┌──────┴───────┐    ┌─────┴──────┐    ┌────┴─────┐    ┌────┴────┐
│  User   │    │ MessageInput │    │ ChatbotPage  │    │  Sidebar   │    │  Backend │    │ MongoDB │
└─────────┘    └──────────────┘    └──────────────┘    └────────────┘    └──────────┘    └─────────┘
```

---

## Detailed Step-by-Step Explanation

### Phase 1: User Input Capture (Steps 1-4)

#### Step 1-2: User Types and Sends
User types a message in the textarea and clicks "Send" button or presses Enter.

#### Step 3: MessageInput.handleSend()
```javascript
const handleSend = () => {
    if (message.trim() && !isStreaming) {
        onSendMessage(message);      // Call parent's handler
        setMessage("");              // Clear input
        textareaRef.current.style.height = 'auto';  // Reset height
    }
};
```

#### Step 4: Callback to ChatbotPage
The `onSendMessage` prop calls `handleSendMessage(messageText)` in ChatbotPage.

---

### Phase 2: Conversation Creation (Steps 5-6) - Only for New Conversations

#### Step 5: Check Conversation State
```javascript
let convId = conversationId;
if (!convId) {
    // Need to create new conversation first
}
```

#### Steps 5-6: Create New Conversation (if needed)
```javascript
const res = await fetch('http://localhost:4004/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId })
});
const data = await res.json();
convId = data._id;
setConversationId(convId);
```

---

### Phase 3: Streaming Setup (Steps 7-10)

#### Step 7: Set Streaming State and Add User Message
```javascript
setIsStreaming(true);
setStreamingMessage("");

const userMsg = {
    conversationId: convId,
    sender: 'user',
    content: messageText,
    createdAt: new Date().toISOString(),
    isPending: true
};
setMessages(prev => [...prev, userMsg]);
```

#### Step 9: Disable Send Button
The `isStreaming` state automatically disables the send button and shows a "Stop" button instead.

#### Step 10: Connect to Streaming Endpoint
```javascript
const history = messages.map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.content
}));

const url = new URL(`http://localhost:4004/api/conversations/${convId}/stream`);
url.searchParams.append('query', messageText);
url.searchParams.append('history', JSON.stringify(history));

const eventSource = new EventSource(url);
eventSourceRef.current = eventSource;
```

---

### Phase 4: Node.js Proxy to FastAPI (Step 11)

**conversationController.js - streamMessage:**
```javascript
const streamMessage = async (req, res) => {
    const { conversationId } = req.params;
    const { query, history } = req.query;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Proxy to FastAPI
    const response = await axios({
        method: 'POST',
        url: 'http://localhost:8000/api/chat/stream',
        data: {
            message: query,
            conversation_id: conversationId,
            conversation_history: conversationHistory
        },
        responseType: 'stream',
        timeout: 120000
    });

    // Pipe the stream to client
    response.data.pipe(res);
};
```

---

### Phase 5: FastAPI RAG Processing (Step 12)

**rag_chain_service.py - stream_response:**
```python
async def stream_response(self, question: str, chat_history: str = ""):
    # 1. Retrieve relevant documents
    docs = await retriever_service.retrieve(question)
    context = self._format_docs(docs)

    # 2. Format the German RAG prompt
    prompt_text = self._prompt.format(
        context=context,
        user_question=question,
        chat_history=chat_history
    )

    # 3. Stream the response from Ollama
    llm = llm_manager.get_streaming_llm()
    async for chunk in llm.astream(prompt_text):
        if hasattr(chunk, 'content') and chunk.content:
            yield chunk.content
```

---

### Phase 6: Streaming Response (Steps 13-16 repeated)

**chat_routes.py - stream_response:**
```python
async def event_generator():
    async for chunk in chat_controller.stream_response(request):
        yield f"data: {json.dumps({'content': chunk})}\n\n"
    yield f"data: {json.dumps({'done': True})}\n\n"

return StreamingResponse(
    event_generator(),
    media_type="text/event-stream"
)
```

**Frontend handling:**
```javascript
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.done) {
        eventSource.close();
        setIsStreaming(false);

        // Add AI message to messages
        const aiMsg = {
            sender: 'ai',
            content: fullResponse,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMsg]);
        setStreamingMessage("");

        // Save messages to DB
        saveMessages(messageText, fullResponse);

    } else if (data.content) {
        fullResponse += data.content;
        setStreamingMessage(fullResponse);
    }
};
```

---
what
### Phase 7: Save Messages to DB (Steps N+4 to N+6)

**conversationController.js - createMessageBatch:**
```javascript
const createMessageBatch = async (req, res) => {
    const { conversationId } = req.params;
    const { userMessage, aiMessage, userId, isNewConversation } = req.body;

    let convId = conversationId;

    // Create conversation if new
    if (isNewConversation || conversationId === 'new') {
        const newConv = await conversationService.createConversation({
            userId,
            title: "Untitled"
        });
        convId = newConv._id;
    }

    // Update title if first message
    const conversation = await conversationService.getConversationById(convId);
    if (conversation && conversation.title === "Untitled") {
        const suggestedTitle = userMessage.substring(0, 30) + "...";
        await conversationService.updateConversationTitle(convId, suggestedTitle);
    }

    // Save both messages
    const savedUserMsg = await messageService.createMessage({
        conversationId: convId,
        sender: 'user',
        content: userMessage
    });

    const savedAiMsg = await messageService.createMessage({
        conversationId: convId,
        sender: 'ai',
        content: aiMessage
    });

    res.status(201).json({
        conversationId: convId,
        userMessage: savedUserMsg,
        aiMessage: savedAiMsg
    });
};
```

---

## Data Flow Summary

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │ MessageInput │───>│ ChatbotPage  │───>│ State updates:                       │  │
│  │              │    │              │    │ 1. isStreaming = true                │  │
│  │ "Hello AI!"  │    │ handleSend   │    │ 2. User message added (pending)      │  │
│  └──────────────┘    │ Message()    │    │ 3. streamingMessage updates          │  │
│                      │              │    │ 4. AI message added (complete)       │  │
│                      │              │    │ 5. isStreaming = false               │  │
│                      │              │    └──────────────────────────────────────┘  │
└──────────────────────┼─────────────────────────────────────────────────────────────┘
                       │
                       │ EventSource GET /:convId/stream?query=...
                       ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                           NODE.JS CONVERSATION SERVICE                             │
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ conversationController.streamMessage()                                         ││
│  │                                                                                ││
│  │ 1. Parse query and history from URL params                                     ││
│  │ 2. Set SSE headers                                                             ││
│  │ 3. Proxy POST to FastAPI /api/chat/stream                                      ││
│  │ 4. Pipe SSE stream back to frontend                                            ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────┬────────────────────────────────────────┘
                                            │
                                            │ POST /api/chat/stream
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI LLM SERVICE                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ chat_controller.stream_response() → rag_chain_service.stream_response()       ││
│  │                                                                                ││
│  │ 1. Embed query (Snowflake Arctic Embed)                                      ││
│  │ 2. Search ChromaDB (k=8 documents)                                            ││
│  │ 3. Rerank with mMiniLM cross-encoder (top_k=5) - if enabled                   ││
│  │ 4. Format German RAG prompt with context                                       ││
│  │ 5. Stream tokens from Ollama (qwen2.5:7b-instruct-q4_0)                         ││
│  │ 6. Yield SSE events: {"content": "..."} for each token                         ││
│  │ 7. Yield final event: {"done": true}                                           ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────┘
                       │
                       │ After stream completes:
                       │ POST /:convId/messages/batch
                       ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATABASE                                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────────────────┐│
│  │ Conversation        │    │ Messages                                            ││
│  │ {                   │    │ [                                                   ││
│  │   _id: "abc123",    │    │   { sender: "user", content: "Hello AI!", ... },    ││
│  │   title: "Hello AI!...",│   { sender: "ai", content: "RAG response...", ... }  ││
│  │   userId: "user1"   │    │ ]                                                   ││
│  │ }                   │    │                                                     ││
│  └─────────────────────┘    └─────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Involved

| File | Role |
|------|------|
| `frontend/src/components/MessageInput.jsx` | Captures user input, disables during streaming |
| `frontend/src/pages/ChatbotPage.jsx` | Orchestrates streaming, state management |
| `frontend/src/components/Conversation.jsx` | Displays messages + streaming message |
| `frontend/src/components/AIMessage.jsx` | Renders AI message with streaming cursor |
| `backend/conversation/routes/conversationRoutes.js` | Defines `/stream` and `/messages/batch` routes |
| `backend/conversation/controllers/conversationController.js` | `streamMessage` proxies to FastAPI |
| `backend/llm/routes/chat_routes.py` | FastAPI `/api/chat/stream` endpoint |
| `backend/llm/controllers/chat_controller.py` | Handles streaming logic |
| `backend/llm/services/rag_chain_service.py` | RAG chain with streaming |
| `backend/llm/services/retriever_service.py` | Document retrieval + reranking |

---

## Important Notes

### 1. Streaming Pattern
User messages appear immediately in the UI while the AI response streams token-by-token, providing real-time feedback.

### 2. SSE (Server-Sent Events)
The streaming uses SSE format:
```
data: {"content": "Token1"}
data: {"content": "Token2"}
...
data: {"done": true}
```

### 3. Message Persistence
Messages are saved to MongoDB **after** streaming completes via the `/messages/batch` endpoint. This prevents partial/failed responses from being saved.

### 4. Conversation Title
On the first message, the title changes from "Untitled" to the first 30 characters of the user's message + "...".

### 5. Error Handling
Errors are caught at multiple levels:
- EventSource `onerror` handler on frontend
- SSE error events from Node.js proxy
- Exception handling in FastAPI

---

## State Transitions

```
Initial State:
  isStreaming: false
  messages: []
  streamingMessage: ""

User sends "Hello":
  isStreaming: true
  messages: [{ sender: "user", content: "Hello", isPending: true }]
  streamingMessage: ""

Token 1 received:
  streamingMessage: "Hallo"

Token 2 received:
  streamingMessage: "Hallo, wie"

...

Stream complete:
  isStreaming: false
  messages: [
    { sender: "user", content: "Hello" },
    { sender: "ai", content: "Hallo, wie kann ich Ihnen helfen?" }
  ]
  streamingMessage: ""

Messages saved to DB ✓
```
