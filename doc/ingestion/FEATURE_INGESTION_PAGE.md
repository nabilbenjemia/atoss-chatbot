# IngestionPage Feature Documentation

## Overview

The **IngestionPage** is an admin-only page for document ingestion workflow in the ATOSS GPT application. It enables users to:
1. Upload PDF documents
2. Review and edit extracted content (text, images, tables)
3. Apply helper functions (local or AI-powered) to clean/enhance content
4. Ingest the processed content into a vector database

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │ IngestionPage   │───▶│ ingestionApi.js │───▶│ HTTP Requests       │ │
│  │ (React)         │    │ (Service Layer) │    │                     │ │
│  └─────────────────┘    └─────────────────┘    └──────────┬──────────┘ │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           │
                           ┌───────────────────────────────▼──────────────┐
                           │           Ingestion Service (Node.js)        │
                           │           Port 4005 - Proxy/Mock             │
                           │  ┌─────────────────────────────────────────┐ │
                           │  │ ingestionService.js                     │ │
                           │  │ - getConfig()        [MOCK]             │ │
                           │  │ - uploadForProcessing() [MOCK]          │ │
                           │  │ - ingestToVectorDb() [MOCK]             │ │
                           │  │ - generateEmbeddingPreview() [LOCAL]    │ │
                           │  └─────────────────────────────────────────┘ │
                           │  ┌─────────────────────────────────────────┐ │
                           │  │ contentViewerService.js                 │ │
                           │  │ - runAiHelper()      [MOCK]             │ │
                           │  └─────────────────────────────────────────┘ │
                           └───────────────────────────────┬──────────────┘
                                                           │
                                                           │ [NOT IMPLEMENTED]
                                                           ▼
                           ┌──────────────────────────────────────────────┐
                           │           LLM Service (FastAPI)              │
                           │           Port 8000                          │
                           │  ┌─────────────────────────────────────────┐ │
                           │  │ TODO: Endpoints to implement            │ │
                           │  │ - GET  /api/config                      │ │
                           │  │ - POST /api/docling/process             │ │
                           │  │ - POST /api/ingest                      │ │
                           │  │ - POST /api/helper/{helperId}           │ │
                           │  └─────────────────────────────────────────┘ │
                           └──────────────────────────────────────────────┘
```

### Current Implementation Status

| Layer | Status | Notes |
|-------|--------|-------|
| Frontend (IngestionPage) | ✅ Implemented | Full UI with editing, preview, ingestion |
| Frontend (ingestionApi.js) | ✅ Implemented | Calls Ingestion Service |
| Ingestion Service (Node.js) | ✅ Proxy/Mock | Returns mock data, ready for LLM integration |
| LLM Service (FastAPI) | ❌ Not Implemented | Endpoints need to be created |

### Component Hierarchy

```
IngestionPage.jsx
├── UploadZone.jsx          # Drag-and-drop file upload
├── FileQueue.jsx           # List of uploaded documents
│   └── FileQueueItem.jsx   # Individual file item with status
├── ContentViewer.jsx       # Main content viewing area
│   ├── PageNavigation.jsx  # Page navigation controls
│   └── PageContent.jsx     # Page content renderer
│       ├── TextItem.jsx    # Editable text block
│       ├── ImageItem.jsx   # Image with classification dropdown
│       └── TableItem.jsx   # Table display component
├── HelperPanel.jsx         # Sidebar with helper function buttons
├── SaveBar.jsx             # Undo/redo and save controls
├── IngestionModal.jsx      # Modal for target DB selection
└── RegexInputModal.jsx     # Modal for regex pattern input
```

### Custom Hooks Used

| Hook | Purpose |
|------|---------|
| `useBackendConfig` | Fetches dynamic configuration from backend (available DBs, image classes, embedding models) |
| `useCommandHistory` | Command Pattern undo/redo - stores lightweight commands instead of full state copies (memory efficient for large documents) |
| `useLocalCache` | Persists edit state to localStorage for session recovery |

### Services

| Service | File | Purpose |
|---------|------|---------|
| `ingestionApi.js` | `src/services/ingestionApi.js` | All API calls for document ingestion |

### Configuration

| Config File | Purpose |
|-------------|---------|
| `ingestionConfig.js` | File upload settings, helper definitions, polling intervals, UI settings |
| `ingestionMocks.js` | Mock data for development (replaced by backend in production) |

### Backend Services

| Service | Directory | Port | Purpose | Status |
|---------|-----------|------|---------|--------|
| `ingestion` | `backend/ingestion/` | 4005 | Document upload, processing status, content management | ✅ Mock data |
| `llm` | `backend/llm/` | 8000 | Document processing, embedding generation | ❌ Not implemented |

### ADR Decisions Applied

This feature follows architectural decisions documented in `doc/ingestion/ADR.md`:

- **ADR-001: Strategy and Helper Code Location** - Hybrid approach where backend provides metadata/control and frontend provides local execution code. Config endpoint returns `strategies` and `helpers` arrays with `type: 'local'|'backend'` flags.

- **ADR-002: Component State Management** (Planned) - Context + Reducer with Split Contexts for scalable state management.

---

## Activity-Based Sequence Diagrams

### 1. Document Upload Flow

```mermaid
sequenceDiagram
    participant User
    participant UploadZone
    participant IngestionPage
    participant ingestionApi
    participant IngestionService
    participant LLMService

    User->>UploadZone: Drop/select PDF file
    UploadZone->>UploadZone: validateFiles(file)
    
    alt File Invalid
        UploadZone->>User: Toast error (type/size)
    else File Valid
        UploadZone->>IngestionPage: onFilesSelected([file])
        IngestionPage->>IngestionPage: Add to uploadQueue (QUEUED)
        IngestionPage->>IngestionPage: Update status (UPLOADING)
        IngestionPage->>ingestionApi: uploadDocument(file)
        ingestionApi->>IngestionService: POST /api/ingestion/upload
        IngestionService->>LLMService: Process document (async)
        IngestionService-->>ingestionApi: {documentId, status: 'processing'}
        ingestionApi-->>IngestionPage: {documentId, status: 'processing'}
        IngestionPage->>IngestionPage: Update status (PROCESSING)
        
        loop Poll until ready/error
            IngestionPage->>ingestionApi: getProcessingStatus(documentId)
            ingestionApi->>IngestionService: GET /api/ingestion/{documentId}/status
            IngestionService-->>ingestionApi: {status, progress}
            ingestionApi-->>IngestionPage: {status, progress}
        end
        
        alt Processing Complete
            IngestionPage->>User: Toast "Document ready"
            IngestionPage->>IngestionPage: Auto-select if no doc selected
        else Processing Error
            IngestionPage->>User: Toast error message
        end
    end
```

### 2. Document Selection & Content Loading Flow

```mermaid
sequenceDiagram
    participant User
    participant FileQueue
    participant IngestionPage
    participant ingestionApi
    participant Backend
    participant ContentViewer

    User->>FileQueue: Click on document
    FileQueue->>IngestionPage: onSelect(documentId)
    IngestionPage->>ingestionApi: getExtractedContent(documentId)
    
    Note over ingestionApi,Backend: TODO: GET /api/ingestion/{documentId}/content
    
    ingestionApi-->>IngestionPage: {documentId, filename, pages: [...]}
    IngestionPage->>IngestionPage: resetDocument(content)
    IngestionPage->>IngestionPage: setSelectedDocumentId(documentId)
    IngestionPage->>IngestionPage: setCurrentPage(1)
    IngestionPage->>ContentViewer: Render document content
    ContentViewer->>User: Display page with text/image/table items
```

### 3. Content Editing Flow

```mermaid
sequenceDiagram
    participant User
    participant ContentViewer
    participant PageContent
    participant TextItem/ImageItem
    participant IngestionPage
    participant useCommandHistory
    participant Commands
    participant useLocalCache

    User->>TextItem/ImageItem: Edit content/change classification
    TextItem/ImageItem->>IngestionPage: onEditItem(itemId, newContent) / onClassChange(itemId, newClass)
    IngestionPage->>Commands: Create command (e.g., Commands.editItem(id, new, old))
    IngestionPage->>useCommandHistory: executeCommand(command)
    useCommandHistory->>useCommandHistory: Store command in past[], execute on present
    Note over useCommandHistory: Only command object stored (~1KB), not full state (~5MB)
    IngestionPage->>IngestionPage: setHasUnsavedChanges(true)
    useLocalCache->>useLocalCache: Auto-save to localStorage (debounced)
    IngestionPage->>ContentViewer: Re-render with updated state
```

### 4. Delete/Restore Item Flow

```mermaid
sequenceDiagram
    participant User
    participant TextItem/ImageItem
    participant IngestionPage
    participant useCommandHistory

    User->>TextItem/ImageItem: Click delete button
    TextItem/ImageItem->>IngestionPage: onDeleteItem(itemId)
    IngestionPage->>useCommandHistory: executeCommand(Commands.deleteItem(itemId))
    Note over useCommandHistory: Command stores itemId only, undo() sets deleted=false
    IngestionPage->>User: Toast "Item deleted (can be undone)"
    
    Note over User: Item shows with strikethrough, restore button visible
    
    User->>TextItem/ImageItem: Click restore button
    TextItem/ImageItem->>IngestionPage: onRestoreItem(itemId)
    IngestionPage->>useCommandHistory: executeCommand(Commands.restoreItem(itemId))
    IngestionPage->>User: Toast "Item restored"
```

### 5. Helper Functions Flow

```mermaid
sequenceDiagram
    participant User
    participant HelperPanel
    participant IngestionPage
    participant ingestionApi
    participant Backend

    User->>HelperPanel: Click helper button
    HelperPanel->>IngestionPage: onRunHelper(helperId)
    
    alt Local Helper (remove_logos, remove_empty)
        IngestionPage->>IngestionPage: Process locally in browser
        IngestionPage->>IngestionPage: Update documentState
        IngestionPage->>User: Toast success message
        
    else Regex Helper (delete_regex)
        IngestionPage->>IngestionPage: setShowRegexModal(true)
        User->>IngestionPage: Enter regex pattern
        IngestionPage->>IngestionPage: Apply regex to all text items
        IngestionPage->>User: Toast "X item(s) matched and deleted"
        
    else Backend Helper (ai_image_descriptions)
        IngestionPage->>IngestionPage: setRunningHelper(helperId)
        IngestionPage->>ingestionApi: runBackendHelper(documentId, helperId, params)
        
        Note over ingestionApi,Backend: TODO: POST /api/ingestion/{documentId}/helper
        
        ingestionApi-->>IngestionPage: {success, modifiedItems, message}
        IngestionPage->>IngestionPage: Apply modifiedItems to documentState
        IngestionPage->>User: Toast success/error message
    end
```

### 6. Ingestion to Vector DB Flow

```mermaid
sequenceDiagram
    participant User
    participant SaveBar
    participant IngestionModal
    participant IngestionPage
    participant ingestionApi
    participant Backend
    participant VectorDB

    User->>SaveBar: Click "Ingest" button
    SaveBar->>IngestionPage: setShowIngestionModal(true)
    IngestionPage->>IngestionModal: Open modal
    
    IngestionModal->>User: Show available target DBs
    User->>IngestionModal: Select target DB
    User->>IngestionModal: Click "Start Ingestion"
    
    IngestionModal->>IngestionPage: onConfirm(targetDb)
    IngestionPage->>IngestionPage: setIsIngesting(true)
    IngestionPage->>ingestionApi: startIngestion(documentId, targetDb, content)
    
    Note over ingestionApi,Backend: TODO: POST /api/ingestion/{documentId}/ingest
    
    ingestionApi-->>IngestionPage: {jobId, status: 'started'}
    
    loop Poll until completed/failed
        IngestionPage->>ingestionApi: getIngestionStatus(jobId)
        Note over ingestionApi,Backend: TODO: GET /api/ingestion/job/{jobId}/status
        ingestionApi-->>IngestionPage: {status, progress}
        IngestionPage->>IngestionModal: Update progress bar
    end
    
    alt Ingestion Complete
        Backend->>VectorDB: Store embeddings
        IngestionPage->>IngestionPage: Update queue status (COMPLETED)
        IngestionPage->>IngestionPage: clearCache(), setHasUnsavedChanges(false)
        IngestionPage->>User: Toast "Document ingested successfully!"
    else Ingestion Failed
        IngestionPage->>User: Toast error message
    end
```

### 7. Undo/Redo Flow (Command Pattern)

The undo/redo system uses the **Command Pattern** for memory efficiency. Instead of storing full document snapshots (~5MB each), it stores lightweight command objects (~1KB each).

**Memory Comparison:**
| Approach | 5MB doc, 50 undo steps |
|----------|------------------------|
| Full Snapshots (old) | ~250MB |
| Command Pattern (new) | ~5MB + ~50KB |

```mermaid
sequenceDiagram
    participant User
    participant SaveBar
    participant IngestionPage
    participant useCommandHistory

    Note over User: Keyboard: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo)
    Note over User: Or click Undo/Redo buttons in SaveBar

    User->>SaveBar: Click Undo / Press Ctrl+Z
    SaveBar->>IngestionPage: onUndo()
    IngestionPage->>useCommandHistory: undo()
    useCommandHistory->>useCommandHistory: Pop command from past[]
    useCommandHistory->>useCommandHistory: Call command.undo(present) → new state
    useCommandHistory->>useCommandHistory: Push command to future[]
    IngestionPage->>IngestionPage: setHasUnsavedChanges(true)
    
    User->>SaveBar: Click Redo / Press Ctrl+Shift+Z
    SaveBar->>IngestionPage: onRedo()
    IngestionPage->>useCommandHistory: redo()
    useCommandHistory->>useCommandHistory: Pop command from future[]
    useCommandHistory->>useCommandHistory: Call command.execute(present) → new state
    useCommandHistory->>useCommandHistory: Push command to past[]
    IngestionPage->>IngestionPage: setHasUnsavedChanges(true)
```

**Available Commands:**
| Command | Usage | Stored Data |
|---------|-------|-------------|
| `Commands.editItem(id, new, old)` | Text content edit | itemId, newContent, oldContent |
| `Commands.deleteItem(id)` | Soft delete | itemId only |
| `Commands.restoreItem(id)` | Restore deleted | itemId only |
| `Commands.changeClass(id, new, old)` | Image classification | itemId, newClass, oldClass |
| `Commands.batchDelete(ids)` | Helper: remove logos/empty | Array of itemIds |
| `Commands.batchUpdate(changes)` | AI helper results | Array of {itemId, newValues, oldValues} |
| `Commands.renameDocument(new, old)` | Rename file | newFilename, oldFilename |

### 8. Session Recovery Flow

```mermaid
sequenceDiagram
    participant User
    participant IngestionPage
    participant useLocalCache
    participant localStorage

    IngestionPage->>useLocalCache: hasCache(editStateKey)?
    useLocalCache->>localStorage: Check for cached state
    
    alt Cache Exists
        localStorage-->>useLocalCache: Cached data found
        useLocalCache->>User: Confirm dialog "Resume previous session?"
        
        alt User Confirms
            IngestionPage->>useLocalCache: loadFromCache(editStateKey)
            useLocalCache-->>IngestionPage: {documentState, hasUnsavedChanges}
            IngestionPage->>IngestionPage: resetDocument(cached.documentState)
            IngestionPage->>User: Toast "Restored previous session"
        else User Declines
            IngestionPage->>useLocalCache: clearCache(editStateKey)
            IngestionPage->>IngestionPage: Start fresh
        end
    else No Cache
        IngestionPage->>IngestionPage: Start fresh
    end
```

---

## Backend Integration

The Ingestion Service (`backend/ingestion/`) acts as a **proxy** between the frontend and the LLM Service. Currently, it returns **mock data** because the LLM Service endpoints are not yet implemented.

### API Endpoints (Ingestion Service)

| # | Endpoint | Method | Purpose | Implementation |
|---|----------|--------|---------|----------------|
| 1 | `/api/ingestion/config` | GET | Get backend configuration (ADR-001 hybrid config) | ✅ Mock data |
| 2 | `/api/ingestion/upload` | POST | Upload PDF file for content extraction | ✅ Mock data |
| 3 | `/api/ingestion/preview` | POST | Generate embedding preview from document state | ✅ Local (no LLM needed) |
| 4 | `/api/ingestion/ingest` | POST | Ingest document into vector database | ✅ Mock success |
| 5 | `/api/ingestion/helper` | POST | Run AI helper function | ✅ Mock data |

### API Specifications

#### 1. Get Configuration (ADR-001 Hybrid Config)
```javascript
// GET /api/ingestion/config
// Returns metadata that controls frontend behavior

// Response
{
    // Embedding strategies - controls frontend dropdown
    strategies: [
        { id: 'embed_per_page', label: 'One Embedding per Page', type: 'local', enabled: true },
        { id: 'chunked_fixed', label: 'Fixed-Size Chunks', type: 'local', enabled: true },
        { id: 'semantic_sections', label: 'Semantic Sections (AI)', type: 'backend', enabled: false },
        { id: 'hierarchical', label: 'Hierarchical (AI)', type: 'backend', enabled: false },
    ],
    // Helper functions - controls helper panel buttons
    helpers: [
        { id: 'remove_logos', label: 'Remove All Logos', type: 'local', enabled: true },
        { id: 'remove_empty', label: 'Remove Empty Text', type: 'local', enabled: true },
        { id: 'delete_regex', label: 'Delete by Regex', type: 'local', enabled: true, hasInput: true },
        { id: 'ai_image_descriptions', label: 'AI Image Descriptions', type: 'backend', enabled: false },
    ],
    // Target databases
    collections: [
        { id: 'chroma_default', label: 'ChromaDB (Default)' },
        { id: 'chroma_snowflake', label: 'ChromaDB (Snowflake Collection)' },
    ],
    // Image classification options
    imageClasses: ['logo', 'figure', 'chart', 'diagram', 'photo', 'screenshot', 'table_image', 'other'],
    // Embedding models
    embeddingModels: [
        { id: 'default', label: 'Snowflake Arctic Embed', disabled: false },
        { id: 'openai', label: 'OpenAI Ada-002', disabled: true },
    ],
}
```

#### 2. Upload Document
```javascript
// POST /api/ingestion/upload
// Content-Type: multipart/form-data

// Request
const formData = new FormData();
formData.append('file', file);

// Response (currently MOCK data)
{
    success: true,
    filename: "document.pdf",
    content: {
        documentId: "doc_1706428800000",
        filename: "document.pdf",
        totalPages: 3,
        pages: [
            {
                pageNumber: 1,
                items: [
                    { id: "t1", type: "text", content: "# Chapter 1...", deleted: false },
                    { id: "i1", type: "image", imageUrl: "data:...", classification: "logo", deleted: false },
                    // ...
                ]
            },
            // ...more pages
        ]
    }
}
```

#### 3. Preview Embeddings
```javascript
// POST /api/ingestion/preview
// This endpoint runs LOCAL logic (no LLM service call needed)

// Request
{
    strategy: "embed_per_page",
    documentState: { /* full document state */ }
}

// Response
{
    source: "document.pdf",
    document_type: "pdf",
    page_count: 3,
    total_embeddings: 3,
    strategy: "embed_per_page",
    documents: [
        {
            id: "page_1",
            content: "Text content from page 1...",
            metadata: {
                page_num: 1,
                source: "document.pdf",
                char_count: 500,
                word_count: 100,
            }
        },
        // ...
    ]
}
```

#### 4. Ingest to Vector DB
```javascript
// POST /api/ingestion/ingest

// Request
{
    targetDb: "chroma_default",
    documentState: { /* full document state */ },
    strategy: "embed_per_page"
}

// Response (currently MOCK success)
{
    success: true,
    targetDb: "chroma_default",
    strategy: "embed_per_page",
    documentCount: 3,
    message: "[MOCK] Successfully ingested 3 embeddings to chroma_default"
}
```

#### 5. Run AI Helper
```javascript
// POST /api/ingestion/helper

// Request
{
    helperId: "ai_image_descriptions",
    content: { pages: [...] },
    params: {}
}

// Response (currently MOCK data)
{
    success: true,
    modifiedItems: [
        { id: "i1", description: "AI-generated description for logo on page 1" },
        { id: "i2", description: "AI-generated description for diagram on page 2" }
    ],
    message: "Generated descriptions for 2 images"
}
```

### LLM Service Integration (TODO)

When implementing the LLM Service endpoints, the Ingestion Service will proxy requests:

| Ingestion Service | LLM Service (TODO) |
|-------------------|-------------------|
| `GET /api/ingestion/config` | `GET /api/config` |
| `POST /api/ingestion/upload` | `POST /api/docling/process` |
| `POST /api/ingestion/ingest` | `POST /api/ingest` |
| `POST /api/ingestion/helper` | `POST /api/helper/{helperId}` |

---

## Data Structures

### Document State
```typescript
interface DocumentState {
    documentId: string;
    filename: string;
    totalPages: number;
    pages: Page[];
}

interface Page {
    pageNumber: number;
    items: (TextItem | ImageItem | TableItem)[];
}

interface TextItem {
    id: string;
    type: 'text';
    content: string;        // Markdown-formatted text
    deleted: boolean;
}

interface ImageItem {
    id: string;
    type: 'image';
    imageUrl: string;       // Base64 data URL or HTTP URL
    imageWidth: number;
    imageHeight: number;
    classification: string; // 'logo' | 'figure' | 'chart' | etc.
    description?: string;   // AI-generated or manual
    deleted: boolean;
}

interface TableItem {
    id: string;
    type: 'table';
    tableData: {
        headers: string[];
        rows: string[][];
    };
    deleted: boolean;
}
```

### Upload Queue Item
```typescript
interface QueueItem {
    id: string;             // Client-generated unique ID
    file: File;             // Original File object
    filename: string;
    documentId?: string;    // Backend-assigned after upload
    status: DOC_STATUS;     // 'queued' | 'uploading' | 'processing' | 'ready' | 'ingesting' | 'completed' | 'error'
    progress: number;       // 0-100
    error?: string;
}
```

---

## Configuration Reference

### `INGESTION_CONFIG` (ingestionConfig.js)

```javascript
{
    upload: {
        maxFileSizeMB: 10,
        allowedTypes: ['.pdf'],
        allowedMimeTypes: ['application/pdf'],
        maxConcurrentUploads: 3
    },
    image: {
        maxDisplayWidth: 400,
        maxDisplayHeight: 300,
        thumbnailSize: 150
    },
    history: {
        maxUndoSteps: 50
    },
    helpers: {
        local: [
            { id: 'remove_logos', ... },
            { id: 'remove_empty', ... },
            { id: 'delete_regex', hasInput: true, ... }
        ],
        backend: [
            { id: 'ai_image_descriptions', ... }
        ]
    },
    polling: {
        processingStatusMs: 2000,
        ingestionStatusMs: 3000
    },
    storage: {
        editStateKey: 'ingestion_edit_state',
        documentCacheKey: 'ingestion_document_cache'
    },
    ui: {
        pageNavigationDebounceMs: 100,
        autoSaveDebounceMs: 500,
        toastDurationMs: 3000
    }
}
```

---

## Authentication TODOs

Located in `IngestionPage.jsx`:

```javascript
// Line 77-91
useEffect(() => {
    const checkAuth = () => {
        // TODO: Replace with real auth when available
        const user = shouldUseMockAuth() ? mockCurrentUser : getCurrentUser();

        if (!user) {
            toast.error('Please log in to access this page');
            navigate('/');
            return;
        }

        // TODO: Enable role check when backend provides user.role
        // For now, bypass role check in development
        if (!shouldUseMockAuth() && user.role !== 'admin') {
            toast.error('Admin access required');
            navigate(-1);
            return;
        }
    };

    checkAuth();
}, [navigate]);
```

**Action Required:**
1. Ensure `getCurrentUser()` returns user object with `role` property
2. Remove `shouldUseMockAuth()` bypass for production
3. Verify admin role checking logic

---

## File Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/IngestionPage.jsx` | ~607 | Main page component, state management, handlers |
| `src/services/ingestionApi.js` | ~276 | API service with mock implementations |
| `src/hooks/useBackendConfig.js` | ~61 | Backend config fetching hook |
| `src/hooks/useCommandHistory.js` | ~280 | Command Pattern undo/redo (memory efficient) |
| `src/hooks/useLocalCache.js` | ~200 | LocalStorage persistence |
| `src/hooks/useLocalCache.js` | ~200 | LocalStorage persistence |
| `src/config/ingestionConfig.js` | ~119 | Feature configuration |
| `src/mocks/ingestionMocks.js` | ~161 | Mock data for development |
| `src/components/ingestion/index.js` | ~21 | Component exports |
| `src/components/ingestion/constants.js` | ~16 | Status constants |
| `src/components/ingestion/UploadZone.jsx` | ~121 | File upload component |
| `src/components/ingestion/FileQueue.jsx` | ? | File list component |
| `src/components/ingestion/ContentViewer.jsx` | ~83 | Main content area |
| `src/components/ingestion/HelperPanel.jsx` | ~96 | Helper functions sidebar |
| `src/components/ingestion/IngestionModal.jsx` | ~144 | Target DB selection modal |
| `src/components/ingestion/RegexInputModal.jsx` | ? | Regex input modal |
| `src/components/ingestion/SaveBar.jsx` | ? | Undo/redo/save controls |
| `src/components/ingestion/PageContent.jsx` | ? | Page item renderer |
| `src/components/ingestion/PageNavigation.jsx` | ? | Page navigation |
| `src/components/ingestion/TextItem.jsx` | ? | Text editing component |
| `src/components/ingestion/ImageItem.jsx` | ? | Image display/classify component |
| `src/components/ingestion/TableItem.jsx` | ? | Table display component |

---

## Quick Reference: Next Steps

### To Enable Real LLM Service Integration

1. **Implement LLM Service endpoints** in `backend/llm/`:
   - `GET /api/config` - Return configuration
   - `POST /api/docling/process` - PDF content extraction
   - `POST /api/ingest` - Vector DB ingestion
   - `POST /api/helper/{helperId}` - AI helpers

2. **Uncomment proxy code** in Ingestion Service:
   - `backend/ingestion/services/ingestionService.js` - Uncomment axios calls
   - `backend/ingestion/services/contentViewerService.js` - Uncomment axios calls

3. **Update config** to enable backend features:
   - Set `enabled: true` for backend strategies/helpers in `getDefaultConfig()`

### Authentication TODOs

Located in `IngestionPage.jsx`:
- Ensure `getCurrentUser()` returns user object with `role` property
- Remove `shouldUseMockAuth()` bypass for production
- Verify admin role checking logic
