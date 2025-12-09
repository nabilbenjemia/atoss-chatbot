# Stream Endpoint Analysis: `GET /api/conversations/:conversationId/stream?query=...`

## Overview
The `streamMessage` endpoint is designed to handle **Server-Sent Events (SSE)** streaming of AI responses from the FastAPI backend to the frontend in real-time. It acts as a **proxy** between the frontend and the AI service.

---

## Current Implementation Status

### ✅ Backend Implementation (conversationController.js)
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
        // Proxy to FastAPI
        const response = await axios({
            method: 'POST',
            url: 'http://localhost:8000/api/generate',
            data: { 
                query, 
                conversation_history: JSON.parse(history || '[]') 
            },
            responseType: 'stream'
        });

        // Pipe the stream to client
        response.data.pipe(res);

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        res.write(`data: [ERROR] ${error.message}\n\n`);
        res.end();
    }
};
```

**Current Issues:**
- ❌ **NOT connected to frontend** - ChatbotPage.jsx does not use this endpoint
- ❌ **No routes defined** - Not exposed in conversationRoutes.js
- ✅ Implementation logic is correct for SSE streaming

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

## Data Flow Comparison

### Current Implementation (NOT Using Stream)
```
User Message
    ↓
POST /api/conversations/:id/messages
    ↓
Backend calls FastAPI (waits for complete response)
    ↓
Returns full AI response at once
    ↓
Display in UI (instant, no streaming effect)
    ↓
Save both messages to DB
```

### Proposed Implementation (Using Stream) ✅
```
User Message
    ↓
Add user message to UI instantly (pending)
    ↓
EventSource → GET /api/conversations/:id/stream?query=...&history=...
    ↓
Backend proxies POST to FastAPI with streaming response
    ↓
FastAPI returns ServerSentEvent stream
    ↓
Backend pipes stream to frontend via EventSource
    ↓
Frontend receives tokens in real-time: "data: token\n\n"
    ↓
Display tokens appearing one-by-one (typing effect)
    ↓
User can click "Stop" to interrupt stream [FUTURE]
    ↓
After [DONE], save all messages to DB
```

---

## Route Definition (Missing)

### Current Routes (conversationRoutes.js)
```javascript
// These endpoints exist:
router.post('/', createConversation);              // POST
router.get('/:id', getConversationById);          // GET by ID
router.get('/user/:userId', getUserConversations); // GET by user
router.put('/:id', updateConversationTitle);      // PUT
router.delete('/:id', deleteConversation);        // DELETE
```

### Required Addition
```javascript
// ADD THIS:
router.get('/:conversationId/stream', streamMessage); // GET stream
```

⚠️ **Important:** This must come AFTER the specific routes (like `/user/:userId`) in route definition order to avoid conflicts.

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

- [ ] Add route to `conversationRoutes.js`: `router.get('/:conversationId/stream', streamMessage);`
- [ ] Verify `streamMessage` controller correctly proxies to FastAPI
- [ ] Update `ChatbotPage.jsx` to use EventSource instead of regular fetch
- [ ] Handle `[DONE]` marker from FastAPI stream
- [ ] Implement `createMessageBatch` endpoint call after stream completes
- [ ] Add abort controller for "Stop" button interrupt functionality
- [ ] Disable send button during streaming (`isStreaming` state)
- [ ] Update conversation title from first message (using AI or substring)
- [ ] Handle stream errors gracefully

---

## Error Scenarios

1. **FastAPI not responding**
   - Backend returns error via `data: [ERROR] message\n\n`
   - Frontend catches and shows error toast

2. **User closes tab during streaming**
   - EventSource closes automatically
   - Partial messages not saved to DB

3. **Network interruption**
   - User can click "Stop" to abort (future)
   - Partial response shown with "Interrupted" label
