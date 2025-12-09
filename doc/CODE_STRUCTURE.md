# ATOSS GPT - Code Structure Documentation

## Overview

This document provides a comprehensive understanding of the ATOSS GPT chatbot application architecture. The application is a full-stack web application with a React frontend, Node.js/Express backend for conversation management, and a FastAPI Python backend for LLM/RAG operations, using MongoDB as the database.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Frontend Structure](#frontend-structure)
3. [Backend Structure](#backend-structure)
4. [LLM Service Structure](#llm-service-structure)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Component Hierarchy](#component-hierarchy)

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                    │
│                              Port: 5173                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  LoginPage  │  │RegisterPage │  │VerifyEmail  │  │ ChatbotPage │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│   Authentication Service         │  │   Conversation Service           │
│        Port: 4000                │  │        Port: 4004                │
│   (Node.js/Express)              │  │   (Node.js/Express)              │
│   - Login/Register               │  │   - Conversation CRUD            │
│   - JWT Authentication           │  │   - Message CRUD                 │
│   - Email Verification           │  │   - SSE Stream Proxy             │
└─────────────────────────────────┘  └───────────────┬─────────────────┘
                                                      │
                                                      ▼
                                     ┌─────────────────────────────────┐
                                     │   LLM Service (FastAPI)         │
                                     │        Port: 8000               │
                                     │   - RAG Chain                   │
                                     │   - Ollama LLM (Qwen 3 1.7B)    │
                                     │   - Embeddings (Qwen 3 0.6B)    │
                                     │   - Reranker (Jina v3)          │
                                     │   - ChromaDB Vector Store       │
                                     │   - Streaming Responses         │
                                     └─────────────────────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MongoDB Database                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │    Users    │  │Conversations│  │         Messages            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Structure

### Directory Layout

```
frontend/
├── src/
│   ├── App.jsx              # Main application with routing
│   ├── main.jsx             # React entry point
│   ├── index.css            # Global styles
│   ├── App.css              # App-specific styles
│   ├── assets/              # Static assets (images, icons)
│   │   └── index.js         # Asset exports
│   ├── components/          # Reusable UI components
│   │   ├── Sidebar.jsx      # Navigation sidebar with chat history
│   │   ├── Conversation.jsx # Message list display
│   │   ├── MessageInput.jsx # Text input with send button
│   │   ├── AIMessage.jsx    # AI message bubble component
│   │   └── UserMessage.jsx  # User message bubble component
│   ├── pages/               # Page-level components
│   │   ├── ChatbotPage.jsx  # Main chatbot interface
│   │   ├── LoginPage.jsx    # User login
│   │   ├── RegisterPage.jsx # User registration
│   │   ├── VerifyEmailPage.jsx
│   │   └── ForgetPass.jsx   # Password recovery
│   ├── services/
│   │   └── api.js           # API client configuration
│   └── utils/
│       └── validation.js    # Input validation utilities
├── public/                  # Static public assets
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Frontend dependencies
```

### Key Frontend Components

#### 1. `App.jsx` - Application Router
- Defines all application routes using React Router
- Routes: `/` (Login), `/register`, `/verify-email`, `/forget-password`, `/chatbot`

#### 2. `ChatbotPage.jsx` - Main Chat Interface
This is the central component for the AI chatbot feature. It manages:
- **State Management**:
  - `conversationId`: Currently active conversation
  - `messages`: Array of messages in current conversation
  - `conversationTitles`: List of all user's conversations (for sidebar)
  - `isFirstMessage`: Flag to handle first message in new conversation
- **Key Functions**:
  - `fetchMessages()`: Retrieves messages for current conversation
  - `fetchConversationTitles()`: Gets all conversations for sidebar
  - `handleSendMessage()`: Orchestrates sending a message

#### 3. `Sidebar.jsx` - Navigation Sidebar
- Displays chat history list
- Provides "New Chat" functionality
- Collapsible/minimizable interface
- Shows user profile section

#### 4. `MessageInput.jsx` - Message Input Component
- Auto-resizing textarea
- Send button with click handler
- Enter key support for sending messages
- Calls `onSendMessage` prop when message is sent

#### 5. `Conversation.jsx` - Message Display
- Renders list of messages
- Uses `AIMessage` and `UserMessage` components based on sender
- Auto-scrolls to bottom on new messages

#### 6. `AIMessage.jsx` & `UserMessage.jsx` - Message Bubbles
- Display individual messages with styling
- Show timestamp on hover
- Different visual styling for AI vs User messages

---

## Backend Structure

### Conversation Service (Port 4004)

```
backend/conversation/
├── index.js                 # Express server entry point
├── package.json             # Backend dependencies
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── conversationController.js  # Conversation CRUD + Streaming proxy
│   └── messageController.js       # Message handling
├── models/
│   ├── Conversation.js      # Mongoose conversation schema
│   └── Message.js           # Mongoose message schema
├── routes/
│   ├── conversationRoutes.js    # Conversation + Stream API routes
│   └── messageRoutes.js         # Message API routes
└── services/
    ├── conversationService.js   # Conversation business logic
    └── messageService.js        # Message business logic
```

### LLM Service (Port 8000) - FastAPI/Python

```
backend/llm/
├── main.py                  # FastAPI server entry point
├── requirements.txt         # Python dependencies
├── config/
│   └── settings.py          # Environment configuration
├── controllers/
│   └── chat_controller.py   # Chat request handling
├── routes/
│   └── chat_routes.py       # API route definitions
├── models/
│   ├── embedding_model.py   # Qwen 3 Embedding 0.6B manager
│   ├── llm_model.py         # Ollama/ChatOllama manager
│   ├── vectorstore.py       # ChromaDB manager
│   └── reranker_model.py    # Jina Reranker v3 manager
├── services/
│   ├── startup_service.py   # Component initialization
│   ├── retriever_service.py # Document retrieval + reranking
│   └── rag_chain_service.py # RAG chain orchestration
├── benchmark/
│   └── benchmark_llm.py     # LLM benchmarking tools
└── tests/
    ├── test_llm.py          # LLM tests
    └── check_vectorstore.py # Vector store diagnostics
```

### Authentication Service (Port 4000)

```
backend/authentication/
├── index.js                 # Express server entry point
├── controllers/
│   └── AuthController.js    # Auth logic (login, register, etc.)
├── middleware/
│   ├── authMiddleware.js    # JWT verification
│   └── gatewayMiddleware.js # API gateway middleware
├── models/
│   ├── UserCredentials.js   # User model
│   ├── Role.js              # Role model
│   └── Department.js        # Department model
├── services/
│   ├── AuthService.js       # Authentication business logic
│   └── EmailService.js      # Email verification service
└── routes/
    └── authRoutes.js        # Authentication routes
```

---

## Data Models

### Conversation Model

```javascript
{
  _id: ObjectId,           // MongoDB auto-generated ID
  title: String,           // Conversation title (starts as "Untitled")
  userId: String,          // Reference to user
  createdAt: Date          // Timestamp
}
```

### Message Model

```javascript
{
  _id: ObjectId,           // MongoDB auto-generated ID
  conversationId: ObjectId,// Reference to conversation
  sender: String,          // "user" or "ai"
  content: String,         // Message text
  createdAt: Date          // Timestamp
}
```

---

## API Endpoints

### Conversation Endpoints (Base: `http://localhost:4004/api/conversations`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new conversation |
| GET | `/user/:userId` | Get all conversations for a user |
| GET | `/:conversationId/stream` | **SSE stream** - Proxy to LLM for streaming response |
| POST | `/:conversationId/messages/batch` | Batch save user + AI messages after stream completes |
| GET | `/:id` | Get single conversation by ID |
| PUT | `/:id` | Update conversation title |
| DELETE | `/:id` | Delete conversation and its messages |

### Message Endpoints (Base: `http://localhost:4004/api/conversations`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:conversationId/messages` | Create message & get AI response (non-streaming) |
| GET | `/:conversationId/messages` | Get all messages in conversation |
| DELETE | `/messages/:messageId` | Delete single message |

### LLM Endpoints (Base: `http://localhost:8000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info and available endpoints |
| GET | `/health` | Global health check |
| GET | `/api/chat/status` | Detailed status of all components |
| GET | `/api/chat/health` | Simple health check |
| POST | `/api/chat/generate` | Generate complete response |
| POST | `/api/chat/stream` | **SSE stream** - Stream response token by token |

---

## Component Hierarchy

```
App
├── LoginPage
├── RegisterPage
├── VerifyEmailPage
├── ForgetPass
└── ChatbotPage
    ├── Sidebar
    │   └── Conversation List Items
    ├── Conversation
    │   ├── AIMessage (multiple)
    │   └── UserMessage (multiple)
    └── MessageInput
```

---

## State Flow in ChatbotPage

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChatbotPage State                         │
├─────────────────────────────────────────────────────────────────┤
│  conversationId ─────────────┬───────► Sidebar (click sets ID)  │
│                              │                                   │
│  messages[] ─────────────────┼───────► Conversation component   │
│                              │                                   │
│  conversationTitles[] ───────┼───────► Sidebar list             │
│                              │                                   │
│  isFirstMessage ─────────────┴───────► Internal flag            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **React 18+** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

### Backend (Node.js Services)
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Axios** - HTTP client for proxying to LLM service
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Backend (LLM Service - Python)
- **FastAPI** - High-performance async web framework
- **Uvicorn** - ASGI server
- **LangChain** - LLM orchestration framework
- **LangChain-Ollama** - Ollama LLM integration
- **ChromaDB** - Vector database for document storage
- **Sentence-Transformers** - Embedding models
- **Transformers** - Hugging Face model loading (for reranker)
- **Pydantic** - Data validation and settings

### LLM Stack
- **Ollama** - Local LLM runtime
- **Qwen 3 1.7B** - Main LLM model for response generation
- **Qwen 3 Embedding 0.6B** - Document/query embedding model
- **Jina Reranker v3** - Document reranking for improved retrieval

---

## Important Notes

1. **Authentication Flow**: Users must be logged in to access the chatbot. The `ChatbotPage` checks for `userId` and redirects to login if not authenticated.

2. **Streaming AI Response**: The system uses Server-Sent Events (SSE) for real-time streaming:
   - Frontend connects to `/:conversationId/stream` on the conversation service
   - Conversation service proxies to FastAPI `/api/chat/stream`
   - FastAPI streams tokens from Ollama LLM
   - Messages are saved to DB after stream completes via `/messages/batch`

3. **RAG Pipeline**: The LLM service implements a full RAG pipeline:
   - Query embedding using Qwen 3 Embedding 0.6B
   - Vector search in ChromaDB (k=16 initial documents)
   - Reranking with Jina Reranker v3 (top k=5)
   - Context formatting with German RAG prompt template
   - Streaming response generation via Ollama

4. **Conversation Titles**: New conversations start with "Untitled" and are renamed from the first message content (first 30 characters).

5. **Real-time Updates**: The app uses SSE for streaming responses. Messages are batch-saved after streaming completes.
