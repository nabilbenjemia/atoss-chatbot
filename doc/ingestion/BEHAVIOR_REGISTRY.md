# Ingestion Behavior Registry

This document defines the expected behaviors for the ingestion system. Each behavior is documented with its trigger, expected outcome, and implementation reference.

---

## File Management Behaviors

### BHV-001: Delete Uploaded File
**Trigger:** User clicks delete on an uploaded file in the Files section

**Expected Behavior:**
| Item | Action |
|------|--------|
| Uploaded file entry | ✅ Removed from list and cache |
| Content cache | ✅ Removed |
| Command history | ✅ Removed |
| All ingested versions | ✅ Removed (all strategies) |
| Embedding caches | ✅ Removed (for all ingested versions) |

**Rationale:** When the source file is deleted, all derived data (ingested versions) should be removed since the source is no longer available.

**Implementation:**
- `fileCacheManager.js` → `removeUploadedFile(documentId)`
- `ConnectedFileQueue.jsx` → `handleRemoveUploadedFile()`

---

### BHV-002: Delete Ingested File
**Trigger:** User clicks delete on an ingested file in the Ingested Files section

**Expected Behavior:**
| Item | Action |
|------|--------|
| Uploaded file entry | ❌ Preserved |
| Content cache | ❌ Preserved |
| Command history | ❌ Preserved |
| Ingested file entry | ✅ Removed (only this strategy) |
| Embedding cache | ✅ Removed (only this strategy) |

**Rationale:** User may want to:
- Re-ingest with a different strategy
- Modify the page content and re-ingest
- The source file should remain available for these workflows

**Implementation:**
- `fileCacheManager.js` → `removeIngestedFile(ingestedId)`
- `ConnectedFileQueue.jsx` → `handleRemoveIngestedFile()`

---

## Ingestion Behaviors

### BHV-003: Ingest Same PDF with Different Strategy
**Trigger:** User ingests the same PDF document using a different ingestion strategy

**Expected Behavior:**
- Creates a **new** ingested file entry
- `ingestedId` format: `${documentId}_${strategy}` ensures uniqueness
- Both ingested versions appear in the Ingested Files list
- Each has its own embedding cache

**Example:**
```
Document: report.pdf (documentId: "abc123")

First ingestion (strategy: "slides_qa"):
  → ingestedId: "abc123_slides_qa"
  
Second ingestion (strategy: "full_text"):
  → ingestedId: "abc123_full_text"
  
Result: Two separate entries in Ingested Files
```

**Implementation:**
- `fileCacheManager.js` → `saveIngestedFile()` uses `${documentId}_${strategy}` as key
- `FileQueueModel.js` → `addIngestedFile()` checks `ingestedId` for duplicates

---

### BHV-004: Re-ingest Same PDF with Same Strategy
**Trigger:** User ingests the same PDF document using the same strategy (e.g., after modifying content)

**Expected Behavior:**
- **Updates** the existing ingested file entry (does not create duplicate)
- Overwrites the embedding cache with new embeddings
- Timestamp is updated to reflect re-ingestion time
- `embeddingCount` is updated to reflect new embedding count

**Example:**
```
Document: report.pdf (documentId: "abc123")

First ingestion (strategy: "slides_qa"):
  → ingestedId: "abc123_slides_qa"
  → embeddingCount: 15
  → timestamp: 2026-01-30T10:00:00
  
Re-ingestion after editing (strategy: "slides_qa"):
  → ingestedId: "abc123_slides_qa" (same)
  → embeddingCount: 18 (updated)
  → timestamp: 2026-01-31T14:00:00 (updated)
  
Result: Single entry with updated data
```

**Implementation:**

`fileCacheManager.js` → `createIngestedFile()`:
```javascript
const existingIndex = ingestedFiles.findIndex(f => f.ingestedId === ingestedId);

if (existingIndex >= 0) {
    // UPDATE: Merge existing entry with new data
    ingestedFiles[existingIndex] = {
        ...ingestedFiles[existingIndex],
        ...ingestedEntry,
        ingestedAt: new Date().toISOString(), // Update timestamp
    };
} else {
    // CREATE: Add new entry
    ingestedFiles.push(ingestedEntry);
}
```

`FileQueueModel.js` → `addIngestedFile()`:
```javascript
const existingIndex = this.ingestedFiles.findIndex(
    f => f.ingestedId === item.ingestedId
);

if (existingIndex >= 0) {
    // UPDATE: Replace existing entry
    newIngestedFiles = [
        ...this.ingestedFiles.slice(0, existingIndex),
        item,
        ...this.ingestedFiles.slice(existingIndex + 1),
    ];
} else {
    // CREATE: Add new entry
    newIngestedFiles = [...this.ingestedFiles, item];
}
```

---

## Selection & Navigation Behaviors

### BHV-005: Select Uploaded File
**Trigger:** User clicks on an uploaded file in the Files section

**Expected Behavior:**
- File is highlighted as selected
- Content viewer shows the editable document content
- Content type is set to `EDITOR`
- Command history is loaded (for undo/redo)
- Helper panel shows available edit operations

**Implementation:**
- `IngestionPage.jsx` → Load content effect
- `DocumentModel.js` → `loadDocument()`

---

### BHV-006: Select Ingested File
**Trigger:** User clicks on an ingested file in the Ingested Files section

**Expected Behavior:**
- File is highlighted as selected
- Content viewer shows the embedding preview (read-only)
- Content type is set to `EMBEDDING`
- Command history is NOT loaded (no editing for ingested files)
- Helper panel is hidden or shows ingestion info

**Implementation:**
- `IngestionPage.jsx` → Load content effect with `selectedIngestedFile` check
- `DocumentModel.js` → `setStoredEmbeddings()`

---

## Cache & Persistence Behaviors

### BHV-007: Page Refresh Recovery
**Trigger:** User refreshes the browser page

**Expected Behavior:**
- All uploaded files are restored from localStorage
- All ingested files are restored from localStorage
- Content caches are preserved
- Command histories are preserved
- User can continue where they left off

**Implementation:**
- `IngestionPage.jsx` → Mount effect loads from `fileCacheManager`
- `fileCacheManager.js` → `getUploadedFiles()`, `getIngestedFiles()`

---

### BHV-008: Auto-save Document Changes
**Trigger:** User modifies document content (edit text, delete item, etc.)

**Expected Behavior:**
- Content is auto-saved to localStorage
- Command history is auto-saved (for undo/redo persistence)
- Filename changes are synced to uploaded file entry

**Implementation:**
- `IngestionPage.jsx` → Auto-save effect watches `commandDocumentState`
- `fileCacheManager.js` → `saveFileContent()`, `saveFileHistory()`

---

### BHV-009: Duplicate Ingestion Prevention
**Trigger:** User attempts to ingest content that has already been ingested with the same strategy to the same database

**Expected Behavior:**
- Ingestion is **blocked** with a warning message
- User is informed when the previous ingestion occurred
- No duplicate data is sent to the backend

**Duplicate Detection Logic:**
The system generates a content-based `ingestionId` from:
1. **Content fingerprint** - hash of all active text/image/table items
2. **Strategy** - ingestion strategy (e.g., `slides_qa`, `full_text`)
3. **Target DB** - destination collection

```
ingestionId = hash(content) + "_" + strategy + "_" + targetDb
```

**Scenarios:**

| Scenario | Content | Strategy | Target DB | Result |
|----------|---------|----------|-----------|--------|
| Exact duplicate | Same | Same | Same | ❌ Blocked |
| Edited content | **Modified** | Same | Same | ✅ Allowed |
| Different strategy | Same | **Different** | Same | ✅ Allowed |
| Different database | Same | Same | **Different** | ✅ Allowed |

**Implementation:**
- `fileCacheManager.js` → `generateContentFingerprint()`, `generateIngestionId()`, `checkIngestionDuplicate()`
- `IngestionPage.jsx` → `handleConfirmIngestion()`, `handleConfirmIngestionAll()`

---

## Identifiers Reference

| Identifier | Format | Purpose | Example |
|------------|--------|---------|---------|
| `uploadId` | UUID | Unique upload session ID | `"f47ac10b-58cc..."` |
| `documentId` | Server-assigned | Processed document ID | `"doc_abc123"` |
| `ingestedId` | `${documentId}_${strategy}` | Unique per document+strategy | `"doc_abc123_slides_qa"` |
| `ingestionId` | `${contentHash}_${strategy}_${targetDb}` | Content-based deduplication key | `"a1b2c3_slides_qa_lectures"` |

---

## Helper Function Types

The ingestion system supports two types of helper functions that operate differently based on where processing occurs.

### Local Helpers

**Definition:** Helpers that execute entirely in the frontend browser, directly modifying content in the editor.

**Characteristics:**
- ✅ Instant feedback (no network latency)
- ✅ Works offline
- ✅ Changes applied directly to document state
- ❌ Limited to client-side processing capabilities

**Data Flow:**
```
User Action → Local Helper → Direct Content Modification → Editor Update
```

**Examples:**

| Helper ID | Label | Description |
|-----------|-------|-------------|
| `remove_logos` | Remove All Logos | Finds all images with `classification: "logo"` and marks as `deleted: true` |
| `remove_empty` | Remove Empty Text | Finds text items with empty/whitespace content and marks as deleted |
| `delete_regex` | Delete by Regex | Prompts for regex pattern, marks matching text items as deleted |

**Implementation Pattern:**
```javascript
// Local helper directly modifies document state
const removeLogos = (documentState) => {
    for (const page of documentState.pages) {
        for (const item of page.items) {
            if (item.type === 'image' && item.classification === 'logo') {
                item.deleted = true;
            }
        }
    }
    return documentState; // Modified in place
};
```

---

### Remote Helpers (AI Helpers)

**Definition:** Helpers that send data to the backend for AI processing, returning results that the frontend uses to update the editor.

**Characteristics:**
- ✅ Access to AI models (vision, LLM)
- ✅ Complex processing capabilities
- ❌ Requires network connection
- ❌ Processing latency

**Data Flow:**
```
User Action → Collect Data → POST to Backend → AI Processing → Return Results → Frontend Applies Changes → Editor Update
```

**Examples:**

| Helper ID | Label | Description |
|-----------|-------|-------------|
| `ai_image_descriptions` | AI Image Descriptions | Sends images to vision model, returns descriptions to add to image metadata |

**Implementation Pattern:**
```javascript
// Remote helper: Frontend collects data
const images = collectImagesToProcess(documentState);

// Send to backend
const result = await generateImageDescriptions(documentId, images);
// result.descriptions = [{ imageId, description }, ...]

// Frontend applies returned data
for (const desc of result.descriptions) {
    const item = findItemById(documentState, desc.imageId);
    if (item) {
        item.description = desc.description;
    }
}
```

**Key Difference:** Remote helpers do NOT directly modify content. They:
1. Receive specific data to process (e.g., images array)
2. Process/generate new data (e.g., descriptions)
3. Return the new data
4. Frontend uses returned data to update editor content

---

## Ingestion Strategy Types

Strategies define how document content is transformed into embeddings. They differ in where processing occurs and what data format is returned.

### Local Strategies

**Definition:** Strategies where embedding preparation happens entirely in the frontend, then sent to backend for vector storage.

**Characteristics:**
- ✅ Frontend controls chunking/aggregation logic
- ✅ Immediate preview generation
- ✅ No round-trip for preview
- ❌ Limited to simple aggregation rules

**Data Flow:**
```
Document State → Frontend Aggregation → Preview (local) → Ingest Request → Backend stores embeddings
```

**Examples:**

| Strategy ID | Label | Description |
|-------------|-------|-------------|
| `embed_per_page` | One Embedding per Page | Aggregates all text items of one page into a single markdown text; all page metadata attached to this embedding |
| `chunked_fixed` | Fixed-Size Chunks | Merges all content, splits into ~500 char chunks with overlap |

**`embed_per_page` Detail:**
```javascript
// For each page:
const pageEmbedding = {
    id: `page_${pageNumber}`,
    content: aggregatePageText(page.items),  // All text items → markdown
    metadata: {
        page_num: pageNumber,
        source: filename,
        document_type: 'pdf',
        image_count: countImages(page.items),
        images: extractImageMetadata(page.items),  // All page images
        char_count: content.length,
        word_count: countWords(content)
    }
};
```

**Preview Response (Local):**
```json
{
    "preview": {
        "strategy": "embed_per_page",
        "total_embeddings": 3,
        "documents": [
            {
                "id": "page_1",
                "content": "# Chapter 1\n\nIntroduction text...",
                "metadata": { "page_num": 1, "image_count": 2, ... }
            }
        ]
    }
}
```

---

### Remote Strategies (AI Strategies)

**Definition:** Strategies where the backend AI performs semantic analysis to determine optimal chunking.

**Characteristics:**
- ✅ AI-powered semantic understanding
- ✅ Context-aware chunk boundaries
- ❌ Requires network round-trip for preview
- ❌ Processing latency

**Data Flow:**
```
Document State → Send to Backend → AI Analysis → Return Chunks + Metadata → Preview (from backend) → Ingest (already processed)
```

**Examples:**

| Strategy ID | Label | Description |
|-------------|-------|-------------|
| `semantic_sections` | Semantic Sections (AI) | AI identifies logical sections based on content meaning |
| `hierarchical` | Hierarchical (AI) | AI builds multi-level chunk hierarchy for parent-child retrieval |

**Key Difference:** Remote strategies return **complete, ready-to-use chunks** from the backend:
1. Frontend sends full document content
2. Backend AI analyzes and creates semantic chunks
3. Backend returns chunks with all metadata
4. Frontend displays preview directly (no local processing)
5. Ingestion uses the same pre-computed chunks

**Preview Response (Remote):**
```json
{
    "preview": {
        "strategy": "semantic_sections",
        "total_embeddings": 5,
        "documents": [
            {
                "id": "section_intro",
                "content": "Introduction covering background and motivation...",
                "metadata": {
                    "section_type": "introduction",
                    "semantic_topic": "project_background",
                    "page_range": [1, 2],
                    "confidence": 0.92
                }
            },
            {
                "id": "section_methods",
                "content": "Methodology section describing the approach...",
                "metadata": {
                    "section_type": "methodology",
                    "semantic_topic": "technical_approach",
                    "page_range": [3, 5],
                    "confidence": 0.88
                }
            }
        ]
    }
}
```

---

## Strategy vs Helper Comparison

| Aspect | Local Helper | Remote Helper | Local Strategy | Remote Strategy |
|--------|--------------|---------------|----------------|-----------------|
| **Processing Location** | Frontend | Backend | Frontend | Backend |
| **Purpose** | Clean/modify content | AI-generate metadata | Prepare embeddings | AI-chunk content |
| **Output** | Modified document | Data to apply | Chunks for preview | Ready chunks |
| **Network Required** | ❌ No | ✅ Yes | ❌ No (preview) | ✅ Yes |
| **Example** | Remove logos | AI descriptions | Embed per page | Semantic sections |

---

## Backend Proxy Architecture

The Ingestion Service (Node.js :4005) acts as a **pure proxy** for certain endpoints, forwarding requests to the LLM Service (FastAPI :8000) and returning results to the frontend.

### Proxy Flow

```
Frontend (React)           Ingestion Service (Node:4005)        LLM Service (FastAPI:8000)
      │                              │                                      │
      │── POST /api/ingestion/X ────▶│                                      │
      │                              │── POST /api/ingestion/X ────────────▶│
      │                              │                                      │
      │                              │◀─────────── Response ────────────────│
      │◀───────── Response ──────────│                                      │
```

### Proxy Endpoints

| Ingestion Service Endpoint | LLM Service Endpoint | Purpose |
|---------------------------|---------------------|---------|
| `POST /api/ingestion/convert` | `POST /api/ingestion/convert` | Document conversion via Docling |
| `POST /api/ingestion/ingest` | `POST /api/ingestion/ingest` | Store embeddings in ChromaDB |
| `GET /api/ingestion/collections` | `GET /api/ingestion/collections` | List available ChromaDB collections |
| `POST /api/ingestion/collection` | `POST /api/ingestion/collection` | Create new ChromaDB collection |
| `POST /api/ingestion/helper/:id` | `POST /api/ingestion/helper/:id` | Run remote AI helper |
| `POST /api/ingestion/strategy/:id` | `POST /api/ingestion/strategy/:id` | Run remote AI strategy |

### Why Proxy?

1. **Single Entry Point**: Frontend only needs to know about one backend URL
2. **Auth Middleware**: Ingestion service can add authentication headers
3. **Logging/Monitoring**: Centralized request logging
4. **Future Flexibility**: Can add caching, rate limiting, etc.

### LLM Service Responsibilities

The LLM Service (Python/FastAPI) owns:
- **ChromaDB**: All collections, embeddings, vector operations
- **Docling**: PDF/PPTX conversion and picture classification
- **AI Helpers**: Vision models, LLM-based processing
- **AI Strategies**: Semantic chunking, hierarchical chunking
- **Configuration**: Available helpers, strategies, collections

### Configuration Source

```
LLM Service owns the config:
┌─────────────────────────────────────────────────────────────┐
│  backend/llm/config/ingestion_config.json                   │
│  - available_strategies (remote only)                       │
│  - available_helpers (remote only)                          │
│  - available_collections (from ChromaDB)                    │
│  - embedding_models                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Ingestion Service merges with local config:                │
│  - pictureClassifications.json (Docling classes)            │
│  - Adds local strategies/helpers                            │
│  → Returns unified config to frontend                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ChromaDB Architecture

### Current Implementation: Directory-per-Collection

The current implementation creates **a new directory per collection** (e.g., `chroma_db_merged`, `chroma_db_snowflake`), but uses the **same collection name** (`tum_docs` from `CHROMA_COLLECTION_NAME`) inside each directory.

**Directory Structure:**
```
resources/chroma_db/                         # CHROMA_DB_DIRECTORY (parent)
├── chroma_db_merged/                        # Collection directory (targetDb from UI)
│   └── [ChromaDB internal files]
│       └── collection: "tum_docs"           # CHROMA_COLLECTION_NAME
│
├── chroma_db_snowflake/                     # Another collection directory
│   └── [ChromaDB internal files]
│       └── collection: "tum_docs"           # Same collection name
│
└── my_new_collection/                       # Created by user via UI
    └── [ChromaDB internal files]
        └── collection: "tum_docs"           # Same collection name
```

**Configuration Settings:**
```python
# backend/llm/config/settings.py
CHROMA_DB_DIRECTORY: str = "./resources/chroma_db"           # Parent directory
CHROMA_PERSIST_DIRECTORY: str = "./resources/chroma_db/chroma_db_merged"  # Default
CHROMA_COLLECTION_NAME: str = "tum_docs"                     # Used in ALL directories
```

**Data Flow:**
```
Frontend: targetDb = "chroma_db_snowflake"
    ↓
LLM Service: collection_path = CHROMA_DB_DIRECTORY.parent / targetDb
    ↓
ChromaDB: client = PersistentClient(path=collection_path)
    ↓
ChromaDB: collection = client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)
```

**Rationale:**
- Each "collection" in the UI is isolated in its own directory
- Allows independent backup/deletion of collections
- Simplifies collection discovery (scan directories)
- `CHROMA_COLLECTION_NAME` acts as a constant internal name

**Alternative Approach (Not Implemented):**
Single ChromaDB directory with multiple collection names:
```
resources/chroma_db/                         # Single ChromaDB instance
└── [ChromaDB internal files]
    ├── collection: "lectures"
    ├── collection: "manuals"
    └── collection: "faqs"
```
This would be more memory-efficient but harder to manage independently.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial behavior registry |
| 1.1 | 2026-01-31 | Added BHV-009: Duplicate Ingestion Prevention |
| 1.2 | 2026-01-31 | Added Helper Function Types and Strategy Types documentation |
| 1.3 | 2026-01-31 | Added Backend Proxy Architecture documentation |
| 1.4 | 2026-01-31 | Added ChromaDB Architecture documentation |
