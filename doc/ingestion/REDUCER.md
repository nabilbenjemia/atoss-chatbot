# Ingestion Reducer Documentation

Central state management for the Ingestion Page using Context + Reducer pattern.

## Overview

The ingestion state is managed by a single reducer for **traceability** - all state transitions are visible in one location. State is split into **four domains** with separate React contexts for **fine-grained re-renders**.

```
┌─────────────────────────────────────────────────────────────┐
│                    IngestionProvider                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   useReducer                         │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┐     │   │
│  │  │fileQueue │ document │ preview  │    ui    │     │   │
│  │  └──────────┴──────────┴──────────┴──────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│    ┌─────────────────────┼─────────────────────┐           │
│    │                     │                     │           │
│    ▼                     ▼                     ▼           │
│ FileQueueContext   DocumentContext   PreviewContext        │
│        │                 │                     │           │
│        ▼                 ▼                     ▼           │
│   useFileQueue()   useDocument()      usePreview()        │
│                                                            │
│                    DispatchContext ──► useDispatch()       │
└─────────────────────────────────────────────────────────────┘
```

## State Structure

### FileQueue Domain

Manages the file upload queue and ingested files.

```javascript
fileQueue: {
    uploadQueue: [
        {
            id: string,           // Unique upload ID
            documentId: string,   // Document ID from backend
            filename: string,     // Original filename
            status: DOC_STATUS,   // 'queued' | 'uploading' | 'processing' | 'ready' | 'error'
            progress: number,     // 0-100
            error?: string,       // Error message if status is 'error'
        }
    ],
    ingestedFiles: [
        {
            ingestedId: string,   // Unique ingested ID
            documentId: string,   // Original document ID
            filename: string,     // Filename
            strategy: string,     // Embedding strategy used
            timestamp: number,    // Ingestion timestamp
        }
    ],
    selectedDocumentId: string | null,  // Currently selected file
}
```

### Document Domain

Manages the current document being edited.

```javascript
document: {
    documentState: {              // From useCommandHistory
        filename: string,
        documentId: string,
        pages: [
            {
                pageNumber: number,
                items: [
                    {
                        id: string,
                        type: 'text' | 'image' | 'table',
                        content: string,
                        deleted: boolean,
                        classification?: string,
                        // ... other fields
                    }
                ]
            }
        ]
    } | null,
    currentPage: number,          // 1-indexed current page
    contentType: CONTENT_TYPE,    // 'editor' | 'embedding'
    storedEmbeddings: object | null,  // Stored embeddings for read-only view
}
```

### Preview Domain

Manages the embedding preview state.

```javascript
preview: {
    isPreviewMode: boolean,       // Whether in preview mode
    isLoadingPreview: boolean,    // Loading state
    embeddingPreview: object | null,  // Preview data from API
    previewConfig: {
        targetDb: string,         // Target database
        strategy: string,         // Embedding strategy
    },
    previewDocumentIds: Set<string>,  // Documents in preview (multi-file support)
}
```

### UI Domain

Manages UI state (sidebars, modals, modes).

```javascript
ui: {
    mode: UI_MODE,                // 'editing' | 'preview' | 'readonly'
    leftSidebarCollapsed: boolean,
    rightSidebarCollapsed: boolean,
    rightSidebarStateBeforePreview: boolean,  // Restore after preview
    isDragging: boolean,          // Drag state for upload zone
    multiSelectMode: boolean,
    checkedDocumentIds: Set<string>,
    isEditingTitle: boolean,
    editingTitleValue: string,
    isIngesting: boolean,
    ingestionProgress: number,    // 0-100
    runningHelper: string | null, // Currently running helper ID
    pendingHelper: object | null, // Helper waiting for file selection
    activeModal: MODAL_TYPES | null,  // Current open modal
}
```

## Action Types

### File Queue Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `FILE_UPLOAD_STARTED` | `{ id, file, filename }` | Start a new file upload |
| `FILE_UPLOAD_PROGRESS` | `{ id, status, progress }` | Update upload progress |
| `FILE_UPLOAD_COMPLETE` | `{ id, documentId }` | Complete file upload |
| `FILE_UPLOAD_FAILED` | `{ id, error }` | Mark upload as failed |
| `FILE_SELECTED` | `{ documentId }` | Select a file |
| `FILE_REMOVED` | `{ documentId }` | Remove an uploaded file |
| `FILE_RENAMED` | `{ documentId, newFilename }` | Rename a file |
| `FILES_RESTORED_FROM_CACHE` | `{ uploadQueue, ingestedFiles? }` | Restore files from cache or clear all (when both empty) |
| `INGESTED_FILES_LOADED` | `{ ingestedFiles }` | Load ingested files |
| `INGESTED_FILE_REMOVED` | `{ ingestedId }` | Remove an ingested file |

### Document Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `DOCUMENT_LOADED` | `{ documentState, documentId }` | Load a document |
| `DOCUMENT_MODIFIED` | `{ documentState }` | Update document state |
| `DOCUMENT_RESET` | - | Clear document state |
| `PAGE_CHANGED` | `{ page }` | Change current page |
| `CONTENT_TYPE_CHANGED` | `{ contentType }` | Change content type |
| `STORED_EMBEDDINGS_SET` | `{ embeddings, documentId }` | Set stored embeddings |

### Preview Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `PREVIEW_STARTED` | `{ targetDb, strategy, documentIds, rightSidebarState }` | Start preview mode |
| `PREVIEW_GENERATED` | `{ embeddingPreview }` | Set generated preview |
| `PREVIEW_FAILED` | `{ rightSidebarState }` | Handle preview failure |
| `PREVIEW_CANCELLED` | `{ rightSidebarState }` | Cancel preview mode |
| `PREVIEW_FILE_SWITCHED` | `{ documentId, embeddingPreview }` | Switch preview file |
| `PREVIEW_FILE_REMOVED` | `{ documentId }` | Remove file from preview |

### Ingestion Actions (Cross-Domain)

| Action | Payload | Description |
|--------|---------|-------------|
| `INGESTION_STARTED` | - | Start ingestion process |
| `INGESTION_PROGRESS` | `{ progress }` | Update ingestion progress |
| `INGESTION_COMPLETE` | `{ documentId, ingestedEntry, ingestedData, rightSidebarState }` | Complete single-file ingestion |
| `INGESTION_BATCH_COMPLETE` | `{ ingestedEntries, rightSidebarState }` | Complete multi-file ingestion (Ingest All) |
| `INGESTION_FAILED` | - | Handle ingestion failure |

### UI Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `LEFT_SIDEBAR_TOGGLED` | - | Toggle left sidebar |
| `RIGHT_SIDEBAR_TOGGLED` | - | Toggle right sidebar |
| `MULTI_SELECT_TOGGLED` | - | Toggle multi-select mode |
| `DOCUMENT_CHECKED` | `{ documentId }` | Toggle document checked state |
| `CHECKED_DOCUMENTS_CLEARED` | - | Clear all checked documents |
| `DRAGGING_CHANGED` | `{ isDragging }` | Update drag state |
| `TITLE_EDITING_STARTED` | `{ value }` | Start editing title |
| `TITLE_EDITING_ENDED` | - | End editing title |
| `UI_MODE_CHANGED` | `{ mode }` | Change UI mode |
| `MODAL_OPENED` | `{ modalType }` | Open a modal |
| `MODAL_CLOSED` | - | Close current modal |

### Helper Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `HELPER_STARTED` | `{ helperId }` | Start running a helper |
| `HELPER_COMPLETED` | - | Helper completed successfully |
| `HELPER_FAILED` | - | Helper failed |
| `PENDING_HELPER_SET` | `{ helper }` | Set pending helper |
| `PENDING_HELPER_CLEARED` | - | Clear pending helper |

### Cache Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `CACHE_CLEARED` | `{ all, types }` | Cache was cleared |

## Cross-Domain Actions

Some actions affect multiple domains atomically. This ensures consistency.

### `INGESTION_COMPLETE`

Updates all four domains in a single dispatch:

```javascript
case ActionTypes.INGESTION_COMPLETE: {
    const { documentId, ingestedEntry, ingestedData, rightSidebarState } = action.payload;
    return {
        ...state,
        // Update File Queue domain - add to ingested files
        fileQueue: {
            ...state.fileQueue,
            ingestedFiles: ingestedEntry
                ? [...state.fileQueue.ingestedFiles, ingestedEntry]
                : state.fileQueue.ingestedFiles,
        },
        // Update Document domain - show stored embeddings
        document: {
            ...state.document,
            contentType: CONTENT_TYPE.EMBEDDING,
            storedEmbeddings: ingestedData,
        },
        // Update Preview domain - exit preview mode
        preview: {
            ...state.preview,
            isPreviewMode: false,
            isLoadingPreview: false,
            embeddingPreview: null,
            previewConfig: { targetDb: '', strategy: '' },
            previewDocumentIds: new Set(),
        },
        // Update UI domain - enter readonly mode
        ui: {
            ...state.ui,
            mode: UI_MODE.READONLY,
            isIngesting: false,
            ingestionProgress: 0,
            rightSidebarCollapsed: rightSidebarState,
        },
    };
}
```

### `INGESTION_BATCH_COMPLETE`

Handles multi-file "Ingest All" - adds all ingested entries at once:

```javascript
case ActionTypes.INGESTION_BATCH_COMPLETE: {
    const { ingestedEntries, rightSidebarState } = action.payload;
    
    // Add all ingested entries (avoid duplicates)
    let updatedIngestedFiles = [...state.fileQueue.ingestedFiles];
    for (const entry of ingestedEntries) {
        const existingIndex = updatedIngestedFiles.findIndex(
            f => f.ingestedId === entry.ingestedId
        );
        if (existingIndex >= 0) {
            updatedIngestedFiles[existingIndex] = entry;
        } else {
            updatedIngestedFiles.push(entry);
        }
    }

    return {
        ...state,
        fileQueue: {
            ...state.fileQueue,
            ingestedFiles: updatedIngestedFiles,
            selectedDocumentId: ingestedEntries[0]?.ingestedId,
        },
        document: {
            ...state.document,
            contentType: CONTENT_TYPE.EMBEDDING,
            storedEmbeddings: ingestedEntries[0]?.embeddingPreview || null,
        },
        preview: {
            ...state.preview,
            isPreviewMode: false,
            previewDocumentIds: new Set(),
        },
        ui: {
            ...state.ui,
            mode: UI_MODE.READONLY,
            isIngesting: false,
            multiSelectMode: false,
            checkedDocumentIds: new Set(),
        },
    };
}
```

### `FILES_RESTORED_FROM_CACHE`

Also handles cache clearing when both arrays are empty:

```javascript
case ActionTypes.FILES_RESTORED_FROM_CACHE: {
    const { uploadQueue, ingestedFiles } = action.payload;
    return {
        ...state,
        fileQueue: {
            ...state.fileQueue,
            uploadQueue,
            // Also clear ingestedFiles if provided (for cache clear)
            ...(ingestedFiles !== undefined && { ingestedFiles }),
        },
        // Reset document state when clearing all files
        ...(uploadQueue.length === 0 && {
            document: {
                ...state.document,
                documentState: null,
                currentPage: 0,
                contentType: null,
                storedEmbeddings: null,
            },
        }),
    };
}
```

## Hooks

### Domain Hooks

```javascript
// Read state from specific domains
const { uploadQueue, selectedDocumentId } = useFileQueue();
const { documentState, currentPage } = useDocument();
const { isPreviewMode, embeddingPreview } = usePreview();
const { mode, isIngesting } = useUI();
```

### Dispatch Hook

```javascript
// Stable reference - never causes re-renders
const dispatch = useDispatch();
```

### Action Creator Hook

```javascript
// Pre-bound action creators
const actions = useIngestionActions();

// Usage examples
actions.selectFile(documentId);
actions.changePage(2);
actions.completeIngestion(documentId, ingestedEntry, embeddingPreview, rightSidebarState);
actions.completeBatchIngestion(ingestedEntries, rightSidebarState);  // Multi-file "Ingest All"
actions.clearAllFiles();  // Clears both uploadQueue and ingestedFiles
actions.switchPreviewFile(documentId, embeddingPreview);  // Switch preview in multi-file mode
```

### Selector Hooks

```javascript
// Computed values
const selectedDoc = useSelectedDocument();
const totalPages = useTotalPages();
const inPreview = useIsPreviewMode();
const isModalOpen = useIsModalOpen(MODAL_TYPES.INGESTION);
```

## Re-render Optimization

Each domain has its own context. Components only re-render when their subscribed domain changes:

```javascript
// ✅ Only re-renders when fileQueue changes
function FileList() {
    const { uploadQueue } = useFileQueue();
    return <ul>{uploadQueue.map(f => <li key={f.id}>{f.filename}</li>)}</ul>;
}

// ✅ Only re-renders when document changes
function PageIndicator() {
    const { currentPage } = useDocument();
    return <span>Page {currentPage}</span>;
}

// ✅ Never re-renders (dispatch is stable)
function IngestButton() {
    const dispatch = useDispatch();
    return <button onClick={() => dispatch({ type: 'INGESTION_STARTED' })}>Ingest</button>;
}
```

## File Structure

```
frontend/src/context/ingestion/
├── index.js                 # Public exports
├── IngestionProvider.jsx    # Provider with split contexts
├── ingestionReducer.js      # Reducer function
├── actionTypes.js           # Action type constants
├── constants.js             # Shared constants
└── hooks.js                 # Custom hooks
```

## Testing

```javascript
import { ingestionReducer, initialState } from './ingestionReducer';
import * as ActionTypes from './actionTypes';

describe('ingestionReducer', () => {
    it('should handle FILE_UPLOAD_COMPLETE', () => {
        const state = { ...initialState };
        state.fileQueue.uploadQueue = [{ id: '1', status: 'uploading' }];
        
        const newState = ingestionReducer(state, {
            type: ActionTypes.FILE_UPLOAD_COMPLETE,
            payload: { id: '1', documentId: 'doc-123' },
        });
        
        expect(newState.fileQueue.uploadQueue[0].status).toBe('ready');
        expect(newState.fileQueue.uploadQueue[0].documentId).toBe('doc-123');
    });
});
```
