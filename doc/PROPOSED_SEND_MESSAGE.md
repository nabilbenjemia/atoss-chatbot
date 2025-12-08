# Proposed Flow: Send Message with Streaming AI Response

This document describes the **proposed** flow for sending messages with streaming AI responses. The key changes from the current implementation:

1. **No immediate DB save** - Messages are only saved after AI completes or user interrupts
2. **Streaming AI response** - AI response streams in real-time using Server-Sent Events (SSE)
3. **Disabled send button** - Send button is disabled while AI is streaming
4. **Interrupt capability** - User can stop the AI mid-stream

---

## Comparison: Current vs Proposed

| Aspect | Current Flow | Proposed Flow |
|--------|--------------|---------------|
| Conversation creation | Immediately on first message | After AI completes response |
| User message save | Before AI response | After AI completes |
| AI message save | After generation | After stream completes or interrupt |
| Send button | Always enabled | Disabled during streaming |
| AI response display | All at once | Token-by-token streaming |
| User can interrupt | No | Yes |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                          │
│   React + Vite (Port 5173)                                                          │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ SSE Stream (EventSource)
                                            │ POST for save
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NODE.JS BACKEND                                         │
│   Conversation Service (Port 4004)                                                  │
│   - Proxies streaming from FastAPI                                                  │
│   - Saves messages to MongoDB after completion                                      │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ SSE Stream
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI BACKEND (NEW)                                   │
│   AI Service (Port 8000)                                                            │
│   - Receives user query                                                             │
│   - Returns StreamingResponse                                                       │
│   - Integrates with LLM (OpenAI, etc.)                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram

```
┌─────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐
│  User   │  │MessageInput│  │ChatbotPage │  │ Node Backend│  │ FastAPI  │  │   LLM   │  │ MongoDB │
└────┬────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘  └────┬─────┘  └────┬────┘  └────┬────┘
     │             │               │                │              │             │            │
     │ 1. Type msg │               │                │              │             │            │
     │────────────>│               │                │              │             │            │
     │             │               │                │              │             │            │
     │ 2. Click    │               │                │              │             │            │
     │    "Send"   │               │                │              │             │            │
     │────────────>│               │                │              │             │            │
     │             │               │                │              │             │            │
     │             │ 3. onSend     │                │              │             │            │
     │             │   (message)   │                │              │             │            │
     │             │──────────────>│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 4. setIsStreaming(true)       │             │            │
     │             │               │    setStreamingMessage("")    │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │             │ 5. Disable    │                │              │             │            │
     │             │    Send btn   │                │              │             │            │
     │             │<──────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 6. Add pending │              │             │            │
     │             │               │    user msg    │              │             │            │
     │             │               │    to UI       │              │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │ 7. See user │               │                │              │             │            │
     │    message  │               │                │              │             │            │
     │<────────────────────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 8. EventSource │              │             │            │
     │             │               │    /stream     │              │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
     │             │               │                │ 9. POST      │             │            │
     │             │               │                │    /generate │             │            │
     │             │               │                │─────────────>│             │            │
     │             │               │                │              │             │            │
     │             │               │                │              │ 10. Stream  │            │
     │             │               │                │              │     request │            │
     │             │               │                │              │────────────>│            │
     │             │               │                │              │             │            │
     │             │               │                │              │ 11. Token 1 │            │
     │             │               │                │              │<────────────│            │
     │             │               │                │              │             │            │
     │             │               │                │ 12. SSE:     │             │            │
     │             │               │                │     Token 1  │             │            │
     │             │               │                │<─────────────│             │            │
     │             │               │                │              │             │            │
     │             │               │ 13. SSE:       │              │             │            │
     │             │               │     Token 1    │              │             │            │
     │             │               │<───────────────│              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 14. Append to  │              │             │            │
     │             │               │     streaming  │              │             │            │
     │             │               │     message    │              │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │ 15. See AI  │               │                │              │             │            │
     │     typing  │               │                │              │             │            │
     │<────────────────────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │   ══════════╪═══════════════╪════════════════╪══════════════╪═════════════╪════════════╪═══
     │   ║         │               │           REPEAT STEPS 11-15 FOR EACH TOKEN              ║
     │   ══════════╪═══════════════╪════════════════╪══════════════╪═════════════╪════════════╪═══
     │             │               │                │              │             │            │
     │             │               │                │              │ N. [DONE]   │            │
     │             │               │                │              │<────────────│            │
     │             │               │                │              │             │            │
     │             │               │                │ N+1. SSE:    │             │            │
     │             │               │                │      [DONE]  │             │            │
     │             │               │                │<─────────────│             │            │
     │             │               │                │              │             │            │
     │             │               │ N+2. SSE:      │              │             │            │
     │             │               │      [DONE]    │              │             │            │
     │             │               │<───────────────│              │             │            │
     │             │               │                │              │             │            │
     │             │               │ N+3. setIsStreaming(false)    │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │             │ N+4. Enable   │                │              │             │            │
     │             │     Send btn  │                │              │             │            │
     │             │<──────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ N+5. POST /api/conversations  │             │            │
     │             │               │      (create if needed)       │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
     │             │               │                │──────────────────────────────────────────>│
     │             │               │                │              │             │ Create conv│
     │             │               │                │<─────────────────────────────────────────│
     │             │               │                │              │             │            │
     │             │               │ N+6. POST      │              │             │            │
     │             │               │  /messages     │              │             │            │
     │             │               │  (user + AI)   │              │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
     │             │               │                │───────────────────────────────────────────>│
     │             │               │                │              │             │ Save both  │
     │             │               │                │              │             │ messages   │
     │             │               │                │<──────────────────────────────────────────│
     │             │               │                │              │             │            │
     │             │               │ N+7. 201 OK    │              │             │            │
     │             │               │<───────────────│              │             │            │
     │             │               │                │              │             │            │
     │             │               │ N+8. Refresh   │              │             │            │
     │             │               │      sidebar   │              │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
┌────┴────┐  ┌─────┴──────┐  ┌─────┴──────┐  ┌──────┴──────┐  ┌────┴─────┐  ┌────┴────┐  ┌────┴────┐
│  User   │  │MessageInput│  │ChatbotPage │  │ Node Backend│  │ FastAPI  │  │   LLM   │  │ MongoDB │
└─────────┘  └────────────┘  └────────────┘  └─────────────┘  └──────────┘  └─────────┘  └─────────┘
```

---

## Interrupt Flow (User Clicks Stop)

```
┌─────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐
│  User   │  │MessageInput│  │ChatbotPage │  │   Backend   │
└────┬────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘
     │             │               │                │
     │   (During streaming...)     │                │
     │             │               │                │
     │ Click       │               │                │
     │ "Stop"      │               │                │
     │────────────>│               │                │
     │             │               │                │
     │             │ onInterrupt() │                │
     │             │──────────────>│                │
     │             │               │                │
     │             │               │ Close          │
     │             │               │ EventSource    │
     │             │               │───────────────>│
     │             │               │                │
     │             │               │ setIsStreaming │
     │             │               │ (false)        │
     │             │               │────────┐       │
     │             │               │        │       │
     │             │               │<───────┘       │
     │             │               │                │
     │             │               │ Save partial   │
     │             │               │ AI response    │
     │             │               │ to DB          │
     │             │               │───────────────>│
     │             │               │                │
     │             │               │<───────────────│
     │             │               │                │
     │             │ Enable        │                │
     │             │ Send btn      │                │
     │             │<──────────────│                │
     │             │               │                │
┌────┴────┐  ┌─────┴──────┐  ┌─────┴──────┐  ┌──────┴──────┐
│  User   │  │MessageInput│  │ChatbotPage │  │   Backend   │
└─────────┘  └────────────┘  └────────────┘  └─────────────┘
```

---

## New State Variables in ChatbotPage

```javascript
// Existing states
const [conversationId, setConversationId] = useState(null);
const [messages, setMessages] = useState([]);
const [conversationTitles, setConversationTitles] = useState([]);

// NEW states for streaming
const [isStreaming, setIsStreaming] = useState(false);           // Is AI currently streaming?
const [streamingMessage, setStreamingMessage] = useState("");    // Current streaming content
const [pendingUserMessage, setPendingUserMessage] = useState(null); // User msg waiting to be saved
const [eventSource, setEventSource] = useState(null);            // SSE connection reference
```

---

## UI States

### State 1: Idle (Ready to Send)
```
┌─────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Type your message...                         [Send] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  Send button: ENABLED (blue)
```

### State 2: Streaming (AI Responding)
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ You: What is the weather today?                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ AI: The weather today is sunn█ (typing cursor)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ (disabled)                                   [Stop] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  Send button: DISABLED (gray) → Shows "Stop" button instead
```

### State 3: Completed (Back to Idle)
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ You: What is the weather today?                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ AI: The weather today is sunny with 25°C.        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Type your message...                         [Send] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  Send button: ENABLED (blue)
  Messages saved to DB ✓
```

---

## Implementation Plan

### Phase 1: FastAPI AI Service (New Backend)

#### 1.1 Create FastAPI project structure
```
backend/
├── ai-service/                    # NEW
│   ├── main.py                    # FastAPI app entry
│   ├── requirements.txt           # Python dependencies
│   ├── routers/
│   │   └── generate.py            # Streaming endpoint
│   └── services/
│       └── llm_service.py         # LLM integration
```

#### 1.2 FastAPI Streaming Endpoint
```python
# backend/ai-service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import generate

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4004"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/api")
```

```python
# backend/ai-service/routers/generate.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.llm_service import generate_stream

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    conversation_history: list = []

@router.post("/generate")
async def generate_response(request: QueryRequest):
    return StreamingResponse(
        generate_stream(request.query, request.conversation_history),
        media_type="text/event-stream"
    )
```

```python
# backend/ai-service/services/llm_service.py
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def generate_stream(query: str, history: list):
    """Generator that yields SSE formatted tokens"""
    try:
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                *history,
                {"role": "user", "content": query}
            ],
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                yield f"data: {token}\n\n"
        
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        yield f"data: [ERROR] {str(e)}\n\n"
```

---

### Phase 2: Node.js Backend Updates

#### 2.1 New route for SSE proxy
```javascript
// backend/conversation/routes/messageRoutes.js

// ADD: Streaming endpoint
router.get('/:conversationId/stream', messageController.streamMessage);

// MODIFY: Batch save messages after stream completes
router.post('/:conversationId/messages/batch', messageController.createMessageBatch);
```

#### 2.2 New controller methods
```javascript
// backend/conversation/controllers/messageController.js

const axios = require('axios');

/** GET /api/conversations/:conversationId/stream?query=... */
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

/** POST /api/conversations/:conversationId/messages/batch */
const createMessageBatch = async (req, res) => {
    try {
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
        const conversation = await Conversation.findById(convId);
        if (conversation.title === "Untitled") {
            // TODO: Use AI to generate title from userMessage
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

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createMessage,
    getMessagesByConversationId,
    deleteMessage,
    streamMessage,        // NEW
    createMessageBatch,   // NEW
};
```

---

### Phase 3: Frontend Updates

#### 3.1 Update ChatbotPage.jsx
```javascript
// frontend/src/pages/ChatbotPage.jsx

import { useEffect, useState, useRef } from 'react'
// ... existing imports

export default function ChatbotPage() {
    // ... existing state
    
    // NEW: Streaming states
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState("");
    const eventSourceRef = useRef(null);

    // NEW: Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // NEW: Handle interrupt
    const handleInterrupt = async () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsStreaming(false);
        
        // Save the partial response if there's content
        if (streamingMessage) {
            await saveMessages(pendingUserMessage, streamingMessage);
        }
        setStreamingMessage("");
    };

    // NEW: Save messages to DB
    const saveMessages = async (userMsg, aiMsg) => {
        const isNew = !conversationId;
        
        const response = await fetch(
            `http://localhost:4004/api/conversations/${conversationId || 'new'}/messages/batch`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userMessage: userMsg,
                    aiMessage: aiMsg,
                    userId: userId,
                    isNewConversation: isNew
                })
            }
        );
        
        const data = await response.json();
        
        if (isNew) {
            setConversationId(data.conversationId);
        }
        
        // Finalize messages in state
        setMessages(prev => {
            const updated = [...prev];
            // Update the last two messages with DB IDs
            return updated;
        });
        
        await fetchConversationTitles();
    };

    // MODIFIED: handleSendMessage with streaming
    const handleSendMessage = async (messageText) => {
        if (!userId || isStreaming) return;

        try {
            setIsStreaming(true);
            setStreamingMessage("");

            // Add user message to UI (not saved yet)
            const userMsg = {
                conversationId: conversationId,
                sender: 'user',
                content: messageText,
                createdAt: new Date().toISOString(),
                isPending: true  // Mark as pending
            };
            setMessages(prev => [...prev, userMsg]);

            // Prepare conversation history for context
            const history = messages.map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            // Create EventSource for streaming
            const convId = conversationId || 'new';
            const url = new URL(`http://localhost:4004/api/conversations/${convId}/stream`);
            url.searchParams.append('query', messageText);
            url.searchParams.append('history', JSON.stringify(history));

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            let fullResponse = "";

            eventSource.onmessage = (event) => {
                const data = event.data;
                
                if (data === '[DONE]') {
                    eventSource.close();
                    eventSourceRef.current = null;
                    setIsStreaming(false);
                    
                    // Add final AI message to state
                    const aiMsg = {
                        sender: 'ai',
                        content: fullResponse,
                        createdAt: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    setStreamingMessage("");
                    
                    // NOW save both messages to DB
                    saveMessages(messageText, fullResponse);
                    
                } else if (data.startsWith('[ERROR]')) {
                    console.error('Stream error:', data);
                    eventSource.close();
                    setIsStreaming(false);
                    
                } else {
                    // Append token to streaming message
                    fullResponse += data;
                    setStreamingMessage(fullResponse);
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                eventSource.close();
                eventSourceRef.current = null;
                setIsStreaming(false);
            };

        } catch (error) {
            console.error('Failed to send message:', error);
            setIsStreaming(false);
        }
    };

    return (
        <div className="flex h-screen">
            <Sidebar ... />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Conversation 
                    messages={messages} 
                    streamingMessage={streamingMessage}  // NEW prop
                    isStreaming={isStreaming}            // NEW prop
                />
                <MessageInput 
                    onSendMessage={handleSendMessage} 
                    onInterrupt={handleInterrupt}        // NEW prop
                    isStreaming={isStreaming}            // NEW prop
                />
            </div>
        </div>
    );
}
```

#### 3.2 Update MessageInput.jsx
```javascript
// frontend/src/components/MessageInput.jsx

export default function MessageInput({ onSendMessage, onInterrupt, isStreaming }) {
    // ... existing code

    return (
        <div className="sticky bottom-0 ...">
            <div className="flex items-center gap-1 ...">
                <textarea
                    // ... existing props
                    disabled={isStreaming}  // Disable during streaming
                    className={`... ${isStreaming ? 'bg-gray-100' : 'bg-transparent'}`}
                />
                
                {isStreaming ? (
                    <button 
                        onClick={onInterrupt}
                        className="self-end px-3 py-0 mb-2 bg-red-500 text-white rounded-xl 
                                   hover:bg-red-600 transition-colors duration-200 font-semibold"
                    >
                        Stop
                    </button>
                ) : (
                    <button 
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="self-end px-3 py-0 mb-2 bg-tum-blue text-white rounded-xl 
                                   hover:bg-tum-dark-blue transition-colors duration-200 font-semibold
                                   disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                )}
            </div>
        </div>
    );
}
```

#### 3.3 Update Conversation.jsx
```javascript
// frontend/src/components/Conversation.jsx

const Conversation = ({ messages, streamingMessage, isStreaming }) => {
    // ... existing code

    return (
        <div ref={containerRef} className="flex-1 overflow-y-auto px-16 py-4">
            {messages.map((msg, index) => (
                msg.sender === 'user'
                    ? <UserMessage key={index} message={msg.content} createdAt={msg.createdAt} />
                    : <AIMessage key={index} message={msg.content} createdAt={msg.createdAt} />
            ))}
            
            {/* Show streaming AI message */}
            {isStreaming && streamingMessage && (
                <AIMessage 
                    message={streamingMessage} 
                    isStreaming={true}  // Show typing indicator
                />
            )}
        </div>
    );
};
```

#### 3.4 Update AIMessage.jsx
```javascript
// frontend/src/components/AIMessage.jsx

export default function AIMessage({ message, createdAt, isStreaming }) {
    // ... existing code

    return (
        <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[60%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-2xl break-words">
                    {message}
                    {isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-gray-500 animate-pulse">
                            │
                        </span>
                    )}
                </div>
                {/* ... timestamp */}
            </div>
        </div>
    );
}
```

---

### Phase 4: Testing & Deployment

#### 4.1 Development Testing Checklist
- [ ] FastAPI service starts and responds to /api/generate
- [ ] Node.js proxies SSE correctly
- [ ] Tokens appear one-by-one in UI
- [ ] Send button disables during streaming
- [ ] Stop button interrupts stream
- [ ] Messages save to DB after completion
- [ ] Messages save to DB after interrupt
- [ ] Sidebar updates with new conversation
- [ ] Existing conversations load correctly

#### 4.2 Environment Variables
```env
# backend/ai-service/.env
OPENAI_API_KEY=sk-...
PORT=8000

# backend/conversation/.env
FASTAPI_URL=http://localhost:8000
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/ai-service/*` | CREATE | New FastAPI service for LLM streaming |
| `backend/conversation/routes/messageRoutes.js` | MODIFY | Add streaming and batch save routes |
| `backend/conversation/controllers/messageController.js` | MODIFY | Add stream proxy and batch save |
| `frontend/src/pages/ChatbotPage.jsx` | MODIFY | Add streaming state, EventSource handling |
| `frontend/src/components/MessageInput.jsx` | MODIFY | Add disable state, Stop button |
| `frontend/src/components/Conversation.jsx` | MODIFY | Show streaming message |
| `frontend/src/components/AIMessage.jsx` | MODIFY | Add typing indicator |

---

## Benefits of This Approach

1. **Better UX**: Users see AI "typing" in real-time
2. **Less DB writes**: Only save after completion (not on every message)
3. **User control**: Ability to stop unwanted responses
4. **Efficiency**: No wasted DB storage for interrupted responses
5. **Scalability**: Streaming reduces memory pressure on server
