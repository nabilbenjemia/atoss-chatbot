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
| Conversation creation | Immediately on first message | Before stream starts (same timing) |
| User message save | Saved to DB before AI response | Saved to DB after stream completes |
| AI message save | After generation (partial response) | After stream completes or interrupt |
| Send button | Always enabled | Disabled during streaming |
| AI response display | All at once (waits for completion) | Token-by-token streaming (real-time) |
| User can interrupt | No | Yes (saves partial response) |
| DB efficiency | Multiple writes per exchange | Batch write after completion |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                         │
│   React + Vite (Port 5173)                                                          │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ SSE Stream (EventSource)
                                            │ POST for save
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NODE.JS BACKEND                                        │
│   Conversation Service (Port 4004)                                                  │
│   - Proxies streaming from FastAPI                                                  │
│   - Saves messages to MongoDB after completion                                      │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ SSE Stream
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI BACKEND (NEW)                                  │
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
     │             │               │ 5. Create conv │              │             │            │
     │             │               │    (if needed) │              │             │            │
     │             │               │───────────────────────────────────────────────────────────>│
     │             │               │                │              │             │ Create conv│
     │             │               │<──────────────────────────────────────────────────────────│
     │             │               │                │              │             │            │
     │             │ 6. Disable    │                │              │             │            │
     │             │    Send btn   │                │              │             │            │
     │             │<──────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 7. Add user    │              │             │            │
     │             │               │    msg to UI   │              │             │            │
     │             │               │    (pending)   │              │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │ 8. See user │               │                │              │             │            │
     │    message  │               │                │              │             │            │
     │<────────────────────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 9. EventSource │              │             │            │
     │             │               │    /stream     │              │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
     │             │               │                │ 10. POST     │             │            │
     │             │               │                │     /generate│             │            │
     │             │               │                │─────────────>│             │            │
     │             │               │                │              │             │            │
     │             │               │                │              │ 11. Stream  │            │
     │             │               │                │              │     request │            │
     │             │               │                │              │────────────>│            │
     │             │               │                │              │             │            │
     │             │               │                │              │ 12. Token 1 │            │
     │             │               │                │              │<────────────│            │
     │             │               │                │              │             │            │
     │             │               │                │ 13. SSE:     │             │            │
     │             │               │                │     Token 1  │             │            │
     │             │               │                │<─────────────│             │            │
     │             │               │                │              │             │            │
     │             │               │ 14. SSE:       │              │             │            │
     │             │               │     Token 1    │              │             │            │
     │             │               │<───────────────│              │             │            │
     │             │               │                │              │             │            │
     │             │               │ 15. Append to  │              │             │            │
     │             │               │     streaming  │              │             │            │
     │             │               │     message    │              │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │ 16. See AI  │               │                │              │             │            │
     │     typing  │               │                │              │             │            │
     │<────────────────────────────│                │              │             │            │
     │             │               │                │              │             │            │
     │   ══════════╪═══════════════╪════════════════╪══════════════╪═════════════╪════════════╪═══
     │   ║         │               │           REPEAT STEPS 12-16 FOR EACH TOKEN             ║
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
     │             │               │ N+3. Add AI    │              │             │            │
     │             │               │     msg to UI  │              │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │             │               │ N+4. POST      │              │             │            │
     │             │               │  /messages/    │              │             │            │
     │             │               │  batch         │              │             │            │
     │             │               │───────────────>│              │             │            │
     │             │               │                │              │             │            │
     │             │               │                │──────────────────────────────────────────>│
     │             │               │                │              │             │ Save both  │
     │             │               │                │              │             │ messages   │
     │             │               │                │<──────────────────────────────────────────│
     │             │               │                │              │             │            │
     │             │               │ N+5. 201 OK    │              │             │            │
     │             │               │<───────────────│              │             │            │
     │             │               │                │              │             │            │
     │             │               │ N+6. setIsStreaming(false)    │             │            │
     │             │               │────────┐       │              │             │            │
     │             │               │        │       │              │             │            │
     │             │               │<───────┘       │              │             │            │
     │             │               │                │              │             │            │
     │             │ N+7. Enable   │                │              │             │            │
     │             │     Send btn  │                │              │             │            │
     │             │<──────────────│                │              │             │            │
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
const eventSourceRef = useRef(null);                             // SSE connection reference (useRef for direct access)
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
// backend/conversation/routes/conversationRoutes.js

// ADD: Streaming endpoint (must come AFTER specific routes like /user/:userId)
router.get('/:conversationId/stream', conversationController.streamMessage);

// ADD: Batch save messages after stream completes
router.post('/:conversationId/messages/batch', conversationController.createMessageBatch);
```

#### 2.2 New controller methods
```javascript
// backend/conversation/controllers/conversationController.js

const axios = require('axios');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');

/** GET /api/conversations/:conversationId/stream?query=...&history=... */
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
        const conversation = await conversationService.getConversationById(convId);
        if (conversation && conversation.title === "Untitled") {
             // TODO: Use AI to generate title from userMessage

            // Extract first 30 chars from user message as title
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
    createConversation,
    getConversationById,
    getUserConversations,
    updateConversationTitle,
    deleteConversation,
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
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MessageInput from '../components/MessageInput'
import Conversation from '../components/Conversation'
import { getCurrentUser } from '../services/api'

export default function ChatbotPage() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const userId = currentUser?.id;
    
    // Existing state
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [conversationTitles, setConversationTitles] = useState([]);

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
        
        try {
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
            
            await fetchConversationTitles();
        } catch (error) {
            console.error('Failed to save messages:', error);
        }
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

**Current State:** The component already receives `onSendMessage`, `onInterrupt`, and `isStreaming` props, but doesn't use `isStreaming` to disable the textarea or conditionally show Stop/Send buttons.

**Changes Required:**
1. Disable textarea when `isStreaming` is true
2. Add conditional styling for disabled state (gray background)
3. Conditionally render Stop button (red) or Send button based on `isStreaming`
4. Prevent sending when streaming is in progress

```javascript
// frontend/src/components/MessageInput.jsx

import React, { useRef, useState } from "react";

export default function MessageInput({ onSendMessage, onInterrupt, isStreaming }) {
  const textareaRef = useRef(null);
  const [message, setMessage] = useState("");

  const handleInput = (e) => {
    const textarea = e.target;
    setMessage(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const handleSend = () => {
    if (message.trim() && !isStreaming) {  // ADD: Check isStreaming
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {  // ADD: Check isStreaming
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sticky bottom-0 mt-auto w-full max-w-3xl h-auto mx-auto p-4 bg-white border-t border-tum-gray z-10">
      <div className="flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-tum-blue-light-2 p-1">
        <textarea
          ref={textareaRef}
          placeholder={isStreaming ? "AI is responding..." : "Type your message..."}  // CHANGE: Dynamic placeholder
          disabled={isStreaming}  // ADD: Disable during streaming
          className={`flex-1 outline-none text-gray-700 placeholder-gray-400 resize-y min-h-[40px] max-h-[240px] overflow-y-auto pl-3 py-2 text-sm ${
            isStreaming ? 'bg-gray-100 cursor-not-allowed' : 'bg-transparent'  // ADD: Conditional styling
          }`}
          rows={1}
          onInput={handleInput}
          onKeyPress={handleKeyPress}
          value={message}
        />
        
        {/* CHANGE: Conditional button rendering */}
        {isStreaming ? (
          <button 
            onClick={onInterrupt}
            className="self-end px-3 py-0 mb-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors duration-200 font-semibold"
          >
            Stop
          </button>
        ) : (
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="self-end px-3 py-0 mb-2 bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
      <p className="text-center text-xs text-tum-gray mt-2">
        © Technische Universität München 2026
      </p>
    </div>
  );
}
```

**Key Changes Summary:**
| Location | Change |
|----------|--------|
| `handleSend()` | Add `&& !isStreaming` check |
| `handleKeyPress()` | Add `&& !isStreaming` check |
| `<textarea placeholder>` | Dynamic: "AI is responding..." when streaming |
| `<textarea disabled>` | Set to `{isStreaming}` |
| `<textarea className>` | Add conditional `bg-gray-100 cursor-not-allowed` when streaming |
| Button section | Replace single Send button with conditional Stop/Send buttons |

#### 3.3 Update Conversation.jsx

**Current State:** The component only receives `messages` prop and renders them. It doesn't handle streaming message display.

**Changes Required:**
1. Accept `streamingMessage` and `isStreaming` props
2. Render the streaming AI message below the messages list
3. Update scroll behavior to account for streaming content

```javascript
// frontend/src/components/Conversation.jsx

import AIMessage from "./AIMessage";
import UserMessage from "./UserMessage";
import { useRef, useLayoutEffect, useEffect } from "react";

const Conversation = ({ messages, streamingMessage, isStreaming }) => {  // ADD: new props
    const containerRef = useRef(null);

    const scrollToBottom = () => {
        if (containerRef.current) {
            requestAnimationFrame(() => {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
            });
        }
    };

    useLayoutEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ADD: Scroll when streaming message updates
    useLayoutEffect(() => {
        scrollToBottom();
    }, [streamingMessage]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            scrollToBottom();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="flex-1 overflow-y-auto px-16 py-4">
            {messages.map((msg, index) => (
                msg.sender === 'user'
                    ? <UserMessage key={index} message={msg.content} createdAt={msg.createdAt} />
                    : <AIMessage key={index} message={msg.content} createdAt={msg.createdAt} />
            ))}
            
            {/* ADD: Show streaming AI message */}
            {isStreaming && streamingMessage && (
                <AIMessage 
                    message={streamingMessage} 
                    isStreaming={true}  // Show typing indicator
                />
            )}
        </div>
    );
};

export default Conversation;
```

**Key Changes Summary:**
| Location | Change |
|----------|--------|
| Props | Add `streamingMessage`, `isStreaming` |
| `useLayoutEffect` | Add new hook to scroll when `streamingMessage` updates |
| JSX | Add conditional rendering of streaming AIMessage |

#### 3.4 Update AIMessage.jsx

**Current State:** The component only receives `message` and `createdAt` props. No support for streaming indicator.

**Changes Required:**
1. Accept `isStreaming` prop
2. Render a blinking cursor when streaming

```javascript
// frontend/src/components/AIMessage.jsx

export default function AIMessage({ message, createdAt, isStreaming }) {  // ADD: isStreaming prop
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[60%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-2xl break-words">
                    {message}
                    {/* ADD: Blinking cursor for streaming indicator */}
                    {isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-gray-500 animate-pulse">
                            │
                        </span>
                    )}
                </div>
                {/* Only show timestamp when not streaming */}
                {createdAt && !isStreaming && (
                    <span className="absolute left-0 -bottom-5 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(createdAt)}
                    </span>
                )}
            </div>
        </div>
    )
}
```

**Key Changes Summary:**
| Location | Change |
|----------|--------|
| Props | Add `isStreaming` |
| Message content | Add blinking cursor `│` with `animate-pulse` when streaming |
| Timestamp | Hide timestamp when streaming (no `createdAt` yet) |

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

| File | Action | Current State | Changes Required |
|------|--------|---------------|------------------|
| `backend/ai-service/*` | CREATE | Does not exist | New FastAPI service for LLM streaming |
| `backend/conversation/routes/conversationRoutes.js` | MODIFY | Basic CRUD routes | Add `/stream` and `/messages/batch` routes |
| `backend/conversation/controllers/conversationController.js` | MODIFY | Basic CRUD methods | Add `streamMessage` and `createMessageBatch` methods |
| `frontend/src/pages/ChatbotPage.jsx` | ✅ DONE | Already has streaming logic | Streaming states, EventSource handling, saveMessages already implemented |
| `frontend/src/components/MessageInput.jsx` | MODIFY | Has props but doesn't use `isStreaming` | Add disabled state, conditional Stop/Send button, prevent send during stream |
| `frontend/src/components/Conversation.jsx` | MODIFY | Only renders `messages` | Accept `streamingMessage`/`isStreaming` props, render streaming AI message |
| `frontend/src/components/AIMessage.jsx` | MODIFY | Only `message` and `createdAt` props | Accept `isStreaming` prop, add blinking cursor indicator |

---

## Benefits of This Approach

1. **Better UX**: Users see AI "typing" in real-time
2. **Less DB writes**: Only save after completion (not on every message)
3. **User control**: Ability to stop unwanted responses
4. **Efficiency**: No wasted DB storage for interrupted responses
5. **Scalability**: Streaming reduces memory pressure on server
