# ATOSS GPT - Code Structure Documentation

## Overview

This document provides a comprehensive understanding of the ATOSS GPT chatbot application architecture. The application is a full-stack web application with a React frontend and Node.js/Express backend, using MongoDB as the database.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Frontend Structure](#frontend-structure)
3. [Backend Structure](#backend-structure)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Component Hierarchy](#component-hierarchy)

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
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐   │
│  │   Authentication Service    │  │   Conversation Service       │   │
│  │        Port: 4000           │  │        Port: 4004            │   │
│  └─────────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
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
│   ├── conversationController.js  # Conversation CRUD operations
│   └── messageController.js       # Message handling + AI response
├── models/
│   ├── Conversation.js      # Mongoose conversation schema
│   └── Message.js           # Mongoose message schema
├── routes/
│   ├── conversationRoutes.js    # Conversation API routes
│   └── messageRoutes.js         # Message API routes
└── services/
    ├── conversationService.js   # Conversation business logic
    └── messageService.js        # Message business logic
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
| GET | `/:id` | Get single conversation by ID |
| PUT | `/:id` | Update conversation title |
| DELETE | `/:id` | Delete conversation and its messages |

### Message Endpoints (Base: `http://localhost:4004/api/conversations`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:conversationId/messages` | Create message & get AI response |
| GET | `/:conversationId/messages` | Get all messages in conversation |
| DELETE | `/messages/:messageId` | Delete single message |

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

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

---

## Important Notes

1. **Authentication Flow**: Users must be logged in to access the chatbot. The `ChatbotPage` checks for `userId` and redirects to login if not authenticated.

2. **AI Response Placeholder**: Currently, the AI response is a placeholder. The `messageController.js` contains a TODO comment for integrating with a real GenAI service.

3. **Conversation Titles**: New conversations start with "Untitled" and are renamed when the first message is sent (currently uses timestamp, but has TODO for AI-generated titles).

4. **Real-time Updates**: The app uses polling/manual refresh rather than WebSockets for real-time updates.
