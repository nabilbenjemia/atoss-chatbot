# Ingestion Service

Stateless Node.js/Express microservice that handles document ingestion workflows for ATOSS GPT. Acts as a proxy and configuration aggregator between the frontend and the LLM service.

## Overview

- **Stateless Design** - All document state is managed by the frontend (localStorage)
- **Proxy Pattern** - Routes document processing requests to the LLM service
- **Hybrid Strategies** - Local helpers/strategies run in frontend; remote operations proxied to LLM service
- **Configuration Aggregation** - Merges local config with remote LLM service config

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server (with auto-reload)
npm run dev

# Or start production server
node index.js
```

The service runs at `http://localhost:4006`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4006` | Service port |
| `LLM_SERVICE_URL` | `http://localhost:8000` | LLM service URL for document processing |

## API Endpoints

Base path: `/api/ingestion`

### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET | Get backend config (strategies, helpers, collections, image classes) |
| `/collection` | POST | Create new ChromaDB collection |

### Document Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload PDF for content extraction (multipart/form-data, 10MB limit) |

### Embedding & Ingestion

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/preview` | POST | Generate embedding preview from document state |
| `/ingest` | POST | Ingest documents to vector database |

### AI Helpers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/helper` | POST | Run AI helper function on document content |
| `/helper/image-descriptions` | POST | Generate AI image descriptions using vision model |
| `/helper/image-descriptions/stream` | POST | Stream image descriptions as SSE |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |

## Architecture

```
Frontend (React)
    |  multipart PDF / JSON
    v
Ingestion Service (this, port 4006)
    |  HTTP proxy (FormData / JSON)
    v
LLM Service (port 8000)
    |  PDF parsing, embedding, vector storage
    v
Ingestion Service (aggregates result)
    |  JSON response
    v
Frontend (stores in localStorage)
```

### Processing Modes

**Local** (executed in browser, no server round-trip):
- `embed_per_page` - One embedding per PDF page
- `chunked_fixed` - Fixed-size chunks (~500 chars with overlap)
- `remove_logos` - Filter out logo images
- `remove_empty` - Filter empty text items

**Remote** (proxied to LLM service):
- PDF content extraction via Docling
- Embedding generation
- Vector DB ingestion
- AI image description generation (vision model)
- Semantic chunking strategies

### LLM Service Integration

| LLM Endpoint Called | Purpose | Timeout |
|---------------------|---------|---------|
| `POST /api/ingestion/config` | Fetch collections, models, remote helpers | 5s |
| `POST /api/ingestion/convert` | Extract content from PDF | 2min |
| `POST /api/ingestion/collection` | Create ChromaDB collection | 30s |
| `POST /api/ingestion/ingest` | Ingest documents to vector DB | 2min |
| `POST /api/ingestion/helper/ai_image_descriptions` | Generate image descriptions | 2min |
| `POST /api/ingestion/helper/ai_image_descriptions/stream` | Stream image descriptions (SSE) | 5min |

Fallback: If the LLM service is unavailable, config falls back to local-only and some operations return mock responses for development.

## Configuration Files

- `config/localConfig.json` - Local strategies and helpers definitions
- `config/pictureClassifications.json` - Docling image classification schema (16 classes, categories, presets)

### Image Classification Presets

- **decorative** - Logo, icon, stamp, signature, barcodes (noise to filter out)
- **content** - Charts, flow charts, chemistry structures, maps, screenshots (content-rich)

## Project Structure

```
backend/ingestion/
├── index.js                          # Express app entry point
├── package.json                      # Dependencies & scripts
├── Dockerfile                        # Docker image (Node 20 Alpine)
├── .dockerignore
├── .env.example                      # Environment template
├── config/
│   ├── localConfig.json              # Local strategies & helpers
│   └── pictureClassifications.json   # Image classification schema
├── routes/
│   └── ingestionRoutes.js            # Route definitions with multer
├── controllers/
│   └── ingestionController.js        # Request handlers
└── services/
    ├── ingestionService.js           # Config, upload, ingestion logic
    └── contentViewerService.js       # AI helpers & image descriptions
```

## Docker

```bash
docker build -t atoss-ingestion .
docker run -p 4006:4006 atoss-ingestion
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `axios` | HTTP client for LLM service |
| `multer` | File upload middleware (PDF, 10MB, memory storage) |
| `cors` | CORS middleware |
| `dotenv` | Environment variable loading |
| `form-data` | FormData construction for file proxying |

## License

Internal use only - ATOSS Software AG
