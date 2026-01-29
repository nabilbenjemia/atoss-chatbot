# Ingestion Service API Contracts

> **Status**: All endpoints currently return **MOCK DATA**.  
> When the LLM service is ready, uncomment the actual API calls in the backend services.

## Overview

The Ingestion Service runs on port **4005** and provides document processing, embedding preview, and AI helper functionality. All endpoints are **stateless** - the frontend manages document state in localStorage.

```
Frontend (React)           Ingestion Service (Node.js :4005)        LLM Service (FastAPI :8000)
      │                              │                                      │
      │──── REST API ────────────────│                                      │
      │                              │───── (TODO: Proxy) ──────────────────│
      │                              │                                      │
```

---

## Base URL

```
Development: http://localhost:4005
Docker:      http://ingestion:4005 (internal) or http://localhost:4005 (external)
```

Frontend uses: `VITE_INGESTION_URL` environment variable.

---

## Authentication

All requests should include an auth token (if available):

```
Authorization: Bearer <token>
```

Token is read from `localStorage.getItem('auth_token')`.

---

## Endpoints

### 1. GET `/api/ingestion/config`

Get backend configuration (target DBs, image classes, strategies, helpers).

#### Request
```http
GET /api/ingestion/config
Authorization: Bearer <token>
```

#### Response
```json
{
  "strategies": [
    { "id": "embed_per_page", "label": "One Embedding per Page", "type": "local", "enabled": true },
    { "id": "chunked_fixed", "label": "Fixed-Size Chunks", "type": "local", "enabled": true },
    { "id": "semantic_sections", "label": "Semantic Sections (AI)", "type": "backend", "enabled": false },
    { "id": "hierarchical", "label": "Hierarchical (AI)", "type": "backend", "enabled": false }
  ],
  "helpers": [
    { "id": "remove_logos", "label": "Remove All Logos", "type": "local", "enabled": true },
    { "id": "remove_empty", "label": "Remove Empty Text", "type": "local", "enabled": true },
    { "id": "delete_regex", "label": "Delete by Regex", "type": "local", "enabled": true, "hasInput": true },
    { "id": "ai_image_descriptions", "label": "AI Image Descriptions", "type": "backend", "enabled": true }
  ],
  "collections": [
    { "id": "chroma_default", "label": "ChromaDB (Default)" },
    { "id": "chroma_snowflake", "label": "ChromaDB (Snowflake Collection)" }
  ],
  "imageClasses": [
    "logo", "figure", "chart", "diagram", "photo", "screenshot", "table_image", "other"
  ],
  "embeddingModels": [
    { "id": "default", "label": "Snowflake Arctic Embed", "disabled": false },
    { "id": "openai", "label": "OpenAI Ada-002", "disabled": true }
  ],
  "availableTargetDbs": [...],
  "availableImageClasses": [...]
}
```

#### Frontend Usage
```javascript
import { getBackendConfig } from '../services/ingestionApi';
const config = await getBackendConfig();
```

#### Mock Status
✅ **MOCK** - Returns hardcoded configuration from `getDefaultConfig()`.

---

### 2. POST `/api/ingestion/upload`

Upload a PDF document for content extraction.

#### Request
```http
POST /api/ingestion/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <PDF file>
config: <optional JSON configuration>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | PDF file (max 10MB) |
| `config` | JSON string | ❌ | Optional processing config |

#### Response (Success)
```json
{
  "success": true,
  "filename": "document.pdf",
  "content": {
    "documentId": "doc_1706500000000",
    "filename": "document.pdf",
    "totalPages": 3,
    "pages": [
      {
        "pageNumber": 1,
        "items": [
          {
            "id": "t1",
            "type": "text",
            "content": "# Chapter 1: Introduction\n\nThis document provides...",
            "deleted": false
          },
          {
            "id": "i1",
            "type": "image",
            "imageUrl": "data:image/svg+xml;base64,...",
            "imageWidth": 100,
            "imageHeight": 50,
            "classification": "logo",
            "deleted": false
          },
          {
            "id": "tb1",
            "type": "table",
            "tableData": {
              "headers": ["Role", "Access Level", "Permissions"],
              "rows": [
                ["Admin", "Full", "All features"],
                ["Manager", "Department", "Team schedules"]
              ]
            },
            "deleted": false
          }
        ]
      }
    ]
  }
}
```

#### Response (Error)
```json
{
  "error": "Only PDF files are allowed"
}
```
```json
{
  "error": "Failed to process document",
  "details": "Error message"
}
```

#### Item Types

| Type | Fields |
|------|--------|
| `text` | `id`, `type`, `content`, `deleted` |
| `image` / `picture` | `id`, `type`, `imageUrl`, `imageWidth`, `imageHeight`, `classification`, `deleted` |
| `table` | `id`, `type`, `tableData: { headers: string[], rows: string[][] }`, `deleted` |

#### Frontend Usage
```javascript
import { uploadDocument } from '../services/ingestionApi';
const result = await uploadDocument(file);
// result.content is cached in localStorage
```

#### Mock Status
✅ **MOCK** - Returns `generateMockContent(filename)` with 3 sample pages.

---

### 3. POST `/api/ingestion/preview`

Generate embedding preview from document state.

#### Request
```http
POST /api/ingestion/preview
Content-Type: application/json
Authorization: Bearer <token>

{
  "strategy": "embed_per_page",
  "documentState": {
    "documentId": "doc_123",
    "filename": "document.pdf",
    "totalPages": 3,
    "pages": [...]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strategy` | string | ❌ | `"embed_per_page"` (default) or `"chunked_document"` |
| `documentState` | object | ✅ | Full document state with pages/items |

#### Response
```json
{
  "success": true,
  "preview": {
    "source": "document.pdf",
    "document_type": "pdf",
    "page_count": 3,
    "total_embeddings": 3,
    "strategy": "embed_per_page",
    "documents": [
      {
        "id": "page_1",
        "content": "# Chapter 1: Introduction\n\n...",
        "metadata": {
          "page_num": 1,
          "source": "document.pdf",
          "document_type": "pdf",
          "image_count": 1,
          "images": [
            {
              "uuid": "i1",
              "imageUrl": "...",
              "classification": "logo"
            }
          ],
          "char_count": 500,
          "word_count": 80
        }
      }
    ]
  }
}
```

#### Strategies

| Strategy | Description |
|----------|-------------|
| `embed_per_page` | One embedding per page, preserves page structure |
| `chunked_document` | Merge all content, split into ~500 char chunks with overlap |

#### Frontend Usage
```javascript
import { previewEmbeddings } from '../services/ingestionApi';
const result = await previewEmbeddings('embed_per_page', documentState);
```

#### Mock Status
⚠️ **PARTIAL MOCK** - `generateEmbeddingPreview()` runs actual logic locally, but doesn't call LLM for embeddings.

---

### 4. POST `/api/ingestion/ingest`

Ingest document content into vector database.

#### Request
```http
POST /api/ingestion/ingest
Content-Type: application/json
Authorization: Bearer <token>

{
  "targetDb": "chroma_default",
  "documentState": {...},
  "strategy": "embed_per_page"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetDb` | string | ✅ | Target database ID from config |
| `documentState` | object | ✅ | Full document state |
| `strategy` | string | ❌ | Embedding strategy (default: `embed_per_page`) |

#### Response (Success)
```json
{
  "success": true,
  "targetDb": "chroma_default",
  "strategy": "embed_per_page",
  "documentCount": 3,
  "message": "[MOCK] Successfully ingested 3 embeddings to chroma_default"
}
```

#### Response (Error)
```json
{
  "error": "targetDb is required"
}
```

#### Frontend Usage
```javascript
import { startIngestion } from '../services/ingestionApi';
const result = await startIngestion('chroma_default', documentState, 'embed_per_page');
```

#### Mock Status
✅ **MOCK** - Returns success without actually ingesting. TODO: Call `LLM_SERVICE_URL/api/ingest`.

---

### 5. POST `/api/ingestion/helper`

Run a generic backend AI helper function.

#### Request
```http
POST /api/ingestion/helper
Content-Type: application/json
Authorization: Bearer <token>

{
  "helperId": "ai_image_descriptions",
  "content": {...documentState...},
  "params": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `helperId` | string | ✅ | Helper function ID |
| `content` | object | ✅ | Document content |
| `params` | object | ❌ | Additional parameters |

#### Response
```json
{
  "success": true,
  "modifiedItems": [
    { "id": "i1", "description": "AI-generated description for logo on page 1" }
  ],
  "message": "Generated descriptions for 3 images"
}
```

#### Frontend Usage
```javascript
import { runBackendHelper } from '../services/ingestionApi';
const result = await runBackendHelper('ai_image_descriptions', documentState);
```

#### Mock Status
✅ **MOCK** - Returns mock descriptions via `generateMockImageDescriptions()`.

---

### 6. POST `/api/ingestion/helper/image-descriptions`

Generate AI descriptions for specific images (preferred endpoint).

#### Request
```http
POST /api/ingestion/helper/image-descriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "documentId": "doc_123",
  "images": [
    {
      "id": "i1",
      "imageUrl": "data:image/png;base64,...",
      "classification": "logo",
      "pageNumber": 1
    },
    {
      "id": "i2",
      "imageUrl": "data:image/png;base64,...",
      "classification": "diagram",
      "pageNumber": 2
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documentId` | string | ✅ | Document ID |
| `images` | array | ✅ | Array of image objects |
| `images[].id` | string | ✅ | Image item ID |
| `images[].imageUrl` | string | ✅ | Image URL or base64 data |
| `images[].classification` | string | ❌ | Image classification (affects prompt) |
| `images[].pageNumber` | number | ❌ | Page number for context |

#### Response
```json
{
  "success": true,
  "descriptions": [
    {
      "imageId": "i1",
      "classification": "logo",
      "description": "This appears to be a company or brand logo. Found on page 1. [Mock description - replace with actual AI vision model output]"
    },
    {
      "imageId": "i2",
      "classification": "diagram",
      "description": "This is a diagram illustrating a process, structure, or relationship between components. Found on page 2. [Mock description - replace with actual AI vision model output]"
    }
  ],
  "message": "Generated descriptions for 2 image(s)"
}
```

#### Classification-Aware Prompts

The backend generates different prompts based on image classification:

| Classification | Prompt |
|----------------|--------|
| `logo` | "This appears to be a company or brand logo." |
| `figure` | "This is a figure or illustration that visualizes concepts from the document." |
| `chart` | "This is a chart or graph presenting data. It likely shows trends, comparisons, or distributions." |
| `diagram` | "This is a diagram illustrating a process, structure, or relationship between components." |
| `photo` | "This is a photograph capturing a real-world scene or subject." |
| `screenshot` | "This is a screenshot showing a user interface or application window." |
| `table_image` | "This is an image of a table containing structured data." |
| `other` | "This is a visual element that provides context to the document content." |
| `unclassified` | "This is a visual element found in the document." |

#### Frontend Usage
```javascript
import { generateImageDescriptions } from '../services/ingestionApi';

// Collect images from document state
const images = [];
for (const page of documentState.pages) {
  for (const item of page.items) {
    if ((item.type === 'image' || item.type === 'picture') && !item.deleted) {
      images.push({
        id: item.id,
        imageUrl: item.imageUrl,
        classification: item.classification || 'unclassified',
        pageNumber: page.pageNumber,
      });
    }
  }
}

const result = await generateImageDescriptions(documentState.documentId, images);
// result.descriptions contains { imageId, classification, description } for each image
```

#### Mock Status
✅ **MOCK** - Returns classification-aware mock descriptions via `generateMockImageDescriptionsFromImages()`.

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Technical details (optional)"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (missing required fields)
- `500` - Server Error

---

## Mock vs Production

### Current State (Mock)

All backend services return mock data. The LLM service calls are commented out in:
- `backend/ingestion/services/ingestionService.js`
- `backend/ingestion/services/contentViewerService.js`

### Production (When LLM Ready)

Uncomment the API calls to proxy requests to the LLM service:

```javascript
// In ingestionService.js
const response = await axios.post(`${LLM_SERVICE_URL}/api/docling/process`, ...);

// In contentViewerService.js
const response = await axios.post(`${LLM_SERVICE_URL}/api/helper/image-descriptions`, ...);
```

Expected LLM service endpoints:
- `POST /api/docling/process` - Document content extraction
- `POST /api/ingest` - Vector database ingestion
- `POST /api/helper/{helperId}` - AI helper functions
- `POST /api/helper/image-descriptions` - AI image descriptions

---

## Summary Table

| Endpoint | Method | Mock? | Purpose |
|----------|--------|-------|---------|
| `/api/ingestion/config` | GET | ✅ | Get backend configuration |
| `/api/ingestion/upload` | POST | ✅ | Upload PDF for extraction |
| `/api/ingestion/preview` | POST | ⚠️ | Generate embedding preview |
| `/api/ingestion/ingest` | POST | ✅ | Ingest to vector DB |
| `/api/ingestion/helper` | POST | ✅ | Run generic AI helper |
| `/api/ingestion/helper/image-descriptions` | POST | ✅ | Generate image descriptions |

---

## Frontend Service Layer

All API calls are centralized in `frontend/src/services/ingestionApi.js`:

```javascript
// Configuration
export const getBackendConfig = async () => {...}

// Document Processing
export const uploadDocument = async (file, config = {}) => {...}

// Embedding & Ingestion
export const previewEmbeddings = async (strategy, documentState) => {...}
export const startIngestion = async (targetDb, documentState, strategy) => {...}

// AI Helpers
export const runBackendHelper = async (helperId, content, params = {}) => {...}
export const generateImageDescriptions = async (documentId, images) => {...}
```

---

## Backend Service Layer

```
backend/ingestion/
├── routes/
│   └── ingestionRoutes.js      # Route definitions
├── controllers/
│   └── ingestionController.js  # Request handlers
└── services/
    ├── ingestionService.js     # Page-level operations (config, upload, ingest)
    └── contentViewerService.js # Component-level operations (AI helpers)
```
