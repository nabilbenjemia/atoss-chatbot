# Stream Endpoint Analysis: `GET /api/conversations/:conversationId/stream?query=...`

## Overview
The `streamMessage` endpoint handles **Server-Sent Events (SSE)** streaming of AI responses from the FastAPI LLM backend to the frontend in real-time. It acts as a **proxy** between the frontend and the AI service.

---

## ✅ Current Implementation Status

### ✅ Backend Implementation (conversationController.js) - COMPLETE
```javascript
const streamMessage = async (req, res) => {
    const { conversationId } = req.params;
    const { query, history } = req.query;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        // Parse history and convert to ChatMessage format
        let parsedHistory = [];
        try {
            const decoded = JSON.parse(history || '[]');
            parsedHistory = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
        } catch (e) {
            console.warn('Failed to parse history:', e.message);
        }

        const conversationHistory = parsedHistory.map(msg => ({
            role: msg.role || (msg.sender === 'user' ? 'user' : 'assistant'),
            content: msg.content
        }));

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
            timeout: 120000  // 2 minute timeout
        });

        // Pipe the stream to client
        response.data.pipe(res);

        response.data.on('error', (err) => {
            console.error('Stream error:', err);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('Stream endpoint error:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};
```

**Implementation Status:**
- ✅ **Route defined** - `router.get('/:conversationId/stream', conversationController.streamMessage)`
- ✅ **SSE headers** - Proper headers for streaming
- ✅ **History parsing** - Handles URL-encoded JSON history
- ✅ **FastAPI proxy** - Posts to `/api/chat/stream` with 2-minute timeout
- ✅ **Stream piping** - Pipes response directly to client
- ✅ **Error handling** - Catches and forwards errors as SSE events

---

## Use Cases: When to Call This Endpoint

### **Case 1: New Conversation (First Message)**
**Scenario:** User sends first message in a blank chat

**Flow:**
1. Frontend sends message via `MessageInput.onSend()`
2. `ChatbotPage.handleSendMessage()` creates new conversation:
   ```javascript
   const res = await fetch('http://localhost:4004/api/conversations', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ userId: userId })
   });
   const data = await res.json();
   convId = data._id;
   ```
3. **THIS IS WHERE `/stream` SHOULD BE CALLED:**
   ```javascript
   const eventSource = new EventSource(
       `http://localhost:4004/api/conversations/${convId}/stream?query=${encodeURIComponent(messageText)}&history=[]`
   );
   ```

**Details:**
- `conversationId`: Newly created
- `query`: User's first message
- `history`: Empty array `[]`
- Messages not saved to DB until stream completes

---

### **Case 2: Existing Conversation (Follow-up Message)**
**Scenario:** User sends message in ongoing conversation

**Flow:**
1. User clicks send in existing conversation (conversationId already set)
2. Fetch previous messages from conversation
3. **Call `/stream` WITH history:**
   ```javascript
   const eventSource = new EventSource(
       `http://localhost:4004/api/conversations/${conversationId}/stream?query=${encodeURIComponent(messageText)}&history=${encodeURIComponent(JSON.stringify(previousMessages))}`
   );
   ```

**Details:**
- `conversationId`: Already exists
- `query`: Current user message
- `history`: Array of previous messages formatted as:
  ```json
  [
      { "role": "user", "content": "First message" },
      { "role": "assistant", "content": "First response" },
      { "role": "user", "content": "Second message" },
      { "role": "assistant", "content": "Second response" }
  ]
  ```

---

## Data Flow: Current Streaming Implementation ✅

```
User Message
    ↓
Add user message to UI instantly (pending state)
    ↓
EventSource → GET /api/conversations/:id/stream?query=...&history=...
    ↓
Node.js Backend proxies POST to FastAPI /api/chat/stream
    ↓
FastAPI RAG Chain generates response with Qwen 3 1.7B
    ↓
FastAPI returns ServerSentEvent stream
    ↓
Node.js pipes stream directly to frontend via EventSource
    ↓
Frontend receives tokens in real-time: "data: token\n\n"
    ↓
Display tokens appearing one-by-one (typing effect)
    ↓
User can click "Stop" to interrupt stream [FUTURE]
    ↓
After [DONE], POST /:conversationId/messages/batch saves all messages to DB
```

---

## Route Definition ✅ IMPLEMENTED

### Current Routes (conversationRoutes.js)
```javascript
const {
    createConversation,
    getConversationById,
    getUserConversations,
    updateConversationTitle,
    deleteConversation,
    streamMessage,           // ✅ Streaming proxy
    createMessageBatch       // ✅ Batch save after stream
} = require('../controllers/conversationController');

router.post('/', createConversation);
router.get('/user/:userId', getUserConversations);
router.get('/:id', getConversationById);
router.put('/:id', updateConversationTitle);
router.delete('/:id', deleteConversation);
router.get('/:conversationId/stream', streamMessage);           // ✅ SSE Stream
router.post('/:conversationId/messages/batch', createMessageBatch); // ✅ Batch save
```

**Note:** The `/user/:userId` route is defined before `/:id` to avoid route conflicts.

---

## Frontend Implementation Needed

### Update ChatbotPage.jsx

**Add EventSource listener:**
```javascript
const handleSendMessage = async (messageText) => {
    // ... existing code to create conversation if needed ...

    const userMsg = {
        conversationId: convId,
        sender: 'user',
        content: messageText,
        createdAt: new Date().toISOString()
    };

    // Step 1: Add user message to UI
    setMessages(prev => [...prev, userMsg]);
    setPendingUserMessage(userMsg);

    // Step 2: Set streaming state
    setIsStreaming(true);
    setStreamingMessage("");

    // Step 3: Connect to stream endpoint
    const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));

    const eventSource = new EventSource(
        `http://localhost:4004/api/conversations/${convId}/stream?` +
        `query=${encodeURIComponent(messageText)}&` +
        `history=${encodeURIComponent(JSON.stringify(history))}`
    );

    let fullAIResponse = "";

    eventSource.onmessage = (event) => {
        const data = event.data;

        if (data === "[DONE]") {
            // Stream complete
            eventSource.close();
            setIsStreaming(false);

            // Save both messages to DB
            saveMessagesToDB(convId, messageText, fullAIResponse);
        } else {
            // Append token to streaming message
            fullAIResponse += data;
            setStreamingMessage(fullAIResponse);
        }
    };

    eventSource.onerror = (error) => {
        console.error('Stream error:', error);
        eventSource.close();
        setIsStreaming(false);
    };

    setEventSource(eventSource);
};
```

---

## Summary Table

| Aspect | New Conversation | Existing Conversation |
|--------|-----------------|----------------------|
| **Trigger** | First message sent | Subsequent messages |
| **conversationId** | Created before calling stream | Already exists |
| **query** | Current user message | Current user message |
| **history** | Empty `[]` | All previous message pairs |
| **DB Save** | After stream completes | After stream completes |
| **UI Flow** | Show pending → Stream → Save | Show pending → Stream → Save |
| **Route Called** | `GET /:conversationId/stream?query=...&history=[]` | `GET /:conversationId/stream?query=...&history=[...]` |

---

## Implementation Checklist

- [x] Add route to `conversationRoutes.js`: `router.get('/:conversationId/stream', streamMessage);`
- [x] Verify `streamMessage` controller correctly proxies to FastAPI
- [x] Add `createMessageBatch` endpoint for saving messages after stream completes
- [x] Handle conversation history parsing and formatting
- [x] Set proper SSE headers in stream response
- [x] Pipe FastAPI stream directly to frontend
- [ ] Update frontend `ChatbotPage.jsx` to use EventSource for streaming UI
- [ ] Handle `[DONE]` marker from FastAPI stream in frontend
- [ ] Call `createMessageBatch` endpoint after stream completes in frontend
- [ ] Add abort controller for "Stop" button interrupt functionality
- [ ] Disable send button during streaming (`isStreaming` state)
- [ ] Update conversation title from first message (using AI or substring)
- [ ] Handle stream errors gracefully in frontend UI

---

## Error Scenarios

1. **FastAPI not responding**
   - Backend returns error via `data: {"error": "message"}\n\n`
   - Frontend catches and shows error toast

2. **User closes tab during streaming**
   - EventSource closes automatically
   - Partial messages not saved to DB

3. **Network interruption**
   - User can click "Stop" to abort (future)
   - Partial response shown with "Interrupted" label

4. **Stream timeout**
   - Backend has 2-minute (120000ms) timeout configured
   - Frontend should handle timeout gracefully
