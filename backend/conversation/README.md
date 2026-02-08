# ATOSS.GPT - Conversation Microservice

This document describes the Conversation Microservice implementation for the ATOSS.GPT project.

## Overview

The Conversation Microservice handles:
- **Chat Conversations**: Manages user chat sessions and conversation history
- **Message Storage**: Stores and retrieves chat messages between users and the AI system
- **Analytics**: Tracks query patterns, keywords, and categorization for insights
- **LLM Classification**: Automatically extracts keywords and categorizes user queries

## Architecture

The service operates as a standalone microservice that:
- Manages conversation sessions and message threads
- Integrates with LLM services for intelligent query classification
- Provides analytics and reporting capabilities
- Stores conversation data in MongoDB for persistence

## Project Structure

```
backend/conversation/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   ├── analyticsController.js    # HTTP handlers for analytics endpoints
│   ├── conversationController.js # HTTP handlers for conversation management
│   └── messageController.js      # HTTP handlers for message operations
├── models/
│   ├── Conversation.js      # Conversation data schema
│   ├── Message.js          # Message data schema
│   └── QueryAnalytics.js   # Analytics data schema
├── routes/
│   ├── analyticsRoutes.js  # Analytics API routes
│   ├── conversationRoutes.js # Conversation API routes
│   └── messageRoutes.js    # Message API routes
├── services/
│   ├── analyticsService.js        # Analytics business logic
│   ├── conversationService.js     # Conversation business logic
│   ├── llmClassificationService.js # LLM-based query classification
│   └── messageService.js          # Message business logic
└── index.js                # Main application entry point
```

## Features

### Conversation Management
- Create and manage chat conversation sessions
- Track conversation metadata (title, user, timestamps)
- Update conversation titles dynamically
- Delete conversations and associated messages

### Message Handling
- Store user and AI messages within conversations
- Retrieve conversation history
- Support for different message types (user, assistant)
- Message deletion and management

### Analytics & Insights
- Track query patterns and user behavior
- Keyword extraction from user queries
- Automatic categorization of support requests
- Generate analytics reports and statistics

### LLM Classification
- Intelligent keyword extraction using Ollama LLM
- Automatic categorization into support categories:
  - **Technisch**: Technical issues, bugs, login errors
  - **Anwendung**: Functional usage questions
  - **Zeitwirtschaft/Abrechnung**: Time management and payroll
  - **Dienstplanung**: Planning logic and staffing
  - **Benutzer/Rollen**: Access rights and permissions
  - **Prozessfragen**: Organizational workflows
  - **Schulung/Doku**: Training and documentation requests
  - **Sonstiges**: Other queries

## Environment Configuration

Create a `.env` file in the `backend/conversation` directory with the following variables:

```env
# Server Configuration
PORT=4004
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_conversations

# LLM Service Configuration
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen3:4b-instruct

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Update configuration values

3. **Start the Service**:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Conversation Endpoints

#### GET `/api/conversations/:userId`
Get all conversations for a specific user.

#### POST `/api/conversations`
Create a new conversation.

**Request Body:**
```json
{
  "userId": "user123",
  "title": "ATOSS Time Tracking Question"
}
```

#### GET `/api/conversations/:conversationId`
Get a specific conversation by ID.

#### PUT `/api/conversations/:conversationId`
Update conversation title.

**Request Body:**
```json
{
  "title": "Updated Conversation Title"
}
```

#### DELETE `/api/conversations/:conversationId`
Delete a conversation and all associated messages.

### Message Endpoints

#### GET `/api/conversations/:conversationId/messages`
Get all messages in a conversation.

#### POST `/api/conversations/:conversationId/messages`
Add a new message to a conversation.

**Request Body:**
```json
{
  "sender": "user",
  "content": "How do I create a new schedule in ATOSS?"
}
```

#### DELETE `/api/conversations/:conversationId/messages/:messageId`
Delete a specific message.

### Analytics Endpoints

#### GET `/api/analytics/overview`
Get analytics overview with query statistics.

#### GET `/api/analytics/keywords`
Get top keywords and their frequencies.

#### GET `/api/analytics/categories`
Get query distribution by category.

#### POST `/api/analytics/track`
Track a new query for analytics.

**Request Body:**
```json
{
  "query": "How do I reset my password?",
  "userId": "user123",
  "conversationId": "conv123"
}
```

## Data Models

### Conversation
```javascript
{
  userId: String,      // ID of the user who owns the conversation
  title: String,       // Conversation title
  createdAt: Date,     // Creation timestamp
  updatedAt: Date      // Last update timestamp
}
```

### Message
```javascript
{
  conversationId: ObjectId,  // Reference to conversation
  sender: String,           // 'user' or 'assistant'
  content: String,          // Message content
  createdAt: Date          // Message timestamp
}
```

### QueryAnalytics
```javascript
{
  query: String,           // Original user query
  keywords: [String],      // Extracted keywords
  category: String,        // Classified category
  userId: String,          // User who made the query
  conversationId: ObjectId, // Associated conversation
  timestamp: Date          // Query timestamp
}
```

## LLM Classification System

The service uses Ollama LLM for intelligent query processing:

### Classification Process
1. **Query Analysis**: User query is sent to LLM for analysis
2. **Keyword Extraction**: 2-4 relevant keywords are extracted
3. **Categorization**: Query is classified into predefined support categories
4. **Storage**: Results are stored for analytics and insights

### Categories
- **Technisch**: Technical issues, bugs, login problems
- **Anwendung**: How-to questions and usage guidance
- **Zeitwirtschaft/Abrechnung**: Time tracking and payroll queries
- **Dienstplanung**: Scheduling and planning questions
- **Benutzer/Rollen**: User access and permissions
- **Prozessfragen**: Workflow and process questions
- **Schulung/Doku**: Training and documentation requests
- **Sonstiges**: Uncategorized queries

## Development

### Running in Development Mode
```bash
npm run dev
```

This enables:
- Automatic server restart on file changes
- Detailed request logging
- Error stack traces

### Docker Support
```bash
# Build image
docker build -t atoss-gpt-conversation .

# Run container
docker run -p 4004:4004 atoss-gpt-conversation
```

### Health Check
```bash
curl http://localhost:4004/health
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Verify MongoDB is running
   - Check MONGODB_URI in `.env`
   - Ensure database permissions are correct

2. **LLM Classification Errors**:
   - Verify Ollama service is running
   - Check OLLAMA_BASE_URL configuration
   - Ensure the specified model is available

3. **Message Storage Problems**:
   - Verify conversation exists before adding messages
   - Check message format and required fields
   - Ensure user has permission to access conversation

4. **Analytics Data Issues**:
   - Verify queries are being tracked properly
   - Check if LLM classification is working
   - Ensure analytics service has access to data

### Dependencies

This service requires:
- **MongoDB**: For data persistence
- **Ollama LLM Service**: For query classification (optional, will skip if unavailable)
- **Authentication Service**: For user validation (via API Gateway)

## License

This project is part of the ATOSS.GPT system for TUM Universitäts Klinikum.