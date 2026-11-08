# Ingestion Service

Document ingestion microservice for ATOSS GPT.

## Overview

This is a **stateless** service that handles:
- PDF document upload and processing (via LLM service)
- Embedding preview generation
- AI helper functions (image descriptions, etc.)
- Ingestion to vector database

**Note:** All document state is managed by the frontend (localStorage). This backend only provides processing and AI functionality.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/config` | GET | Get backend configuration (available DBs, image classes) |
| `/api/ingestion/upload` | POST | Upload PDF file, returns extracted content directly |
| `/api/ingestion/preview` | POST | Generate embedding preview from document state |
| `/api/ingestion/ingest` | POST | Ingest document content to vector DB |
| `/api/ingestion/helper` | POST | Run AI helper on document content |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4005` | Service port |
| `LLM_SERVICE_URL` | `http://localhost:8000` | LLM service URL for document processing |

## Services

### ingestionService.js
Page-level operations:
- `getConfig()` - Get backend configuration
- `uploadForProcessing()` - Process PDF and extract content
- `generateEmbeddingPreview()` - Generate embedding preview
- `ingestToVectorDb()` - Ingest to vector database

### contentViewerService.js
Component-level operations (ContentViewer):
- `runAiHelper()` - Run AI helper functions
- `generateImageDescriptions()` - Generate AI image descriptions
