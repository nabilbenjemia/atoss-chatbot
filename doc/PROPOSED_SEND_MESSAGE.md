# ✅ IMPLEMENTED: Send Message with Streaming AI Response

> **Status: IMPLEMENTED** - This document described the proposed streaming implementation. It has now been fully implemented. See `FLOW_SEND_MESSAGE.md` for the current implementation details.

This document describes the streaming flow for sending messages with AI responses. The key features:

1. **Streaming AI response** - AI response streams in real-time using Server-Sent Events (SSE)
2. **Disabled send button** - Send button is disabled while AI is streaming
3. **Batch DB save** - Messages are saved after AI completes streaming
4. **Interrupt capability** - User can stop the AI mid-stream (Stop button)

---

## Comparison: Previous vs Current Implementation

| Aspect | Previous Flow | Current Implementation |
|--------|--------------|------------------------|
| Conversation creation | Immediately on first message | Before stream starts (same timing) |
| User message save | Saved to DB before AI response | Saved to DB after stream completes |
| AI message save | After generation (placeholder) | After stream completes |
| Send button | Always enabled | Disabled during streaming |
| AI response display | Placeholder text | Token-by-token streaming (real-time) |
| User can interrupt | No | Yes (Stop button) |
| DB efficiency | Multiple writes per exchange | Batch write after completion |
| LLM Integration | None (placeholder) | Full RAG pipeline with Ollama |

---

## Architecture Overview (Implemented)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                         │
│   React + Vite (Port 5173)                                                          │
│   - EventSource for SSE streaming                                                   │
│   - isStreaming state for UI control                                                │
│   - streamingMessage state for real-time display                                    │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ GET /:convId/stream?query=...&history=...
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NODE.JS BACKEND                                        │
│   Conversation Service (Port 4004)                                                  │
│   - Proxies SSE streaming from FastAPI                                              │
│   - Saves messages to MongoDB after completion                                      │
│   - Routes: /stream, /messages/batch                                                │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                            │
                                            │ POST /api/chat/stream
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI LLM SERVICE                                    │
│   AI Service (Port 8000)                                                            │
│   - RAG Chain with document retrieval                                               │
│   - qwen2.5:7b-instruct-q4_0 via Ollama for generation                              │
│   - Snowflake Arctic Embed for embeddings                                           │
│   - mMiniLM cross-encoder for reranking (optional)                                  │
│   - ChromaDB for vector storage                                                     │
│   - StreamingResponse for SSE                                                       │
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

## Implementation Status

### ✅ Phase 1: FastAPI AI Service - COMPLETE

```
backend/llm/
├── main.py                  # FastAPI app with lifespan
├── requirements.txt         # Python dependencies
├── config/
│   └── settings.py          # Pydantic settings (Ollama, embedding, etc.)
├── routes/
│   └── chat_routes.py       # /api/chat/stream endpoint
├── controllers/
│   └── chat_controller.py   # ChatController with streaming
├── models/
│   ├── embedding_model.py   # Snowflake Arctic Embed L v2.0
│   ├── llm_model.py         # ChatOllama (qwen2.5:7b-instruct-q4_0)
│   ├── vectorstore.py       # ChromaDB manager
│   └── reranker_model.py    # mMiniLM cross-encoder (optional)
└── services/
    ├── startup_service.py   # Component initialization
    ├── retriever_service.py # Document retrieval + reranking
    └── rag_chain_service.py # RAG chain with German prompt
```

### ✅ Phase 2: Node.js Backend Updates - COMPLETE

**conversationRoutes.js:**
```javascript
// Streaming endpoint
router.get('/:conversationId/stream', conversationController.streamMessage);

// Batch save messages after stream completes
router.post('/:conversationId/messages/batch', conversationController.createMessageBatch);
```

**conversationController.js:**
- `streamMessage` - Proxies SSE from FastAPI
- `createMessageBatch` - Batch saves user + AI messages;

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
