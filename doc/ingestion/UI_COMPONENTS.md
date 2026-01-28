# Ingestion Page UI Components Documentation

> **Last Updated**: Based on latest refactoring (stateless backend, localStorage-based state management)

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Component Hierarchy](#component-hierarchy)
3. [State Management](#state-management)
4. [User Interaction Modes](#user-interaction-modes)
5. [Backend API Triggers](#backend-api-triggers)
6. [Component Reference](#component-reference)
7. [Data Flow Diagrams](#data-flow-diagrams)

---

## Architecture Overview

The Ingestion Page is a document processing and vector database ingestion UI that follows these principles:

- **Stateless Backend**: All document state lives in `localStorage`
- **Command Pattern**: Undo/redo via `useCommandHistory` hook
- **Cache Persistence**: `useLocalCache` + `fileCacheManager.js` for session recovery
- **Three-panel Layout**: Left sidebar (files), Main area (content), Right sidebar (helpers)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IngestionPage.jsx                            │
├─────────────┬───────────────────────────────────┬───────────────────┤
│   Left      │                                   │      Right        │
│  Sidebar    │        Main Content Area          │     Sidebar       │
│             │                                   │                   │
│ ┌─────────┐ │  ┌─────────────────────────────┐  │  ┌─────────────┐  │
│ │Upload   │ │  │   Header / SaveBar          │  │  │HelperPanel  │  │
│ │Zone     │ │  └─────────────────────────────┘  │  │             │  │
│ └─────────┘ │  ┌─────────────────────────────┐  │  │ • Remove    │  │
│ ┌─────────┐ │  │                             │  │  │   Logos     │  │
│ │File     │ │  │   ContentViewer             │  │  │ • Remove    │  │
│ │Queue    │ │  │   ├─ PageContent            │  │  │   Empty     │  │
│ │         │ │  │   │  ├─ TextItem            │  │  │ • Regex Del │  │
│ │ • File1 │ │  │   │  ├─ ImageItem           │  │  │ • AI Image  │  │
│ │ • File2 │ │  │   │  └─ TableItem           │  │  │   Desc      │  │
│ │ • ...   │ │  │   └─ PageNavigation         │  │  └─────────────┘  │
│ └─────────┘ │  │                             │  │                   │
│             │  └─────────────────────────────┘  │                   │
└─────────────┴───────────────────────────────────┴───────────────────┘
```

---

## Component Hierarchy

```
IngestionPage.jsx (1163 lines - main container)
├── UploadZone.jsx          - Drag-drop file upload
├── FileQueue.jsx           - File list with sections
│   └── FileQueueItem.jsx   - Individual file item
├── ContentViewer.jsx       - Main content display
│   ├── PageContent.jsx     - Page items container
│   │   ├── TextItem.jsx    - Editable text (markdown)
│   │   ├── ImageItem.jsx   - Image with classification
│   │   └── TableItem.jsx   - Read-only table
│   └── PageNavigation.jsx  - Page nav buttons
├── HelperPanel.jsx         - AI helper functions
├── SaveBar.jsx             - Undo/redo/save/ingest
├── EmbeddingPreviewViewer.jsx - Preview before ingestion
│   └── EmbeddingPreview.jsx   - Single embedding card
├── IngestionModal.jsx      - Strategy/DB selection
├── RegexInputModal.jsx     - Regex pattern input
├── CacheManagement.jsx     - Cache clearing UI
└── HelperFileSelectModal.jsx - Multi-file helper selection
```

### Constants (`constants.js`)
```javascript
// Document Status Lifecycle
export const DOC_STATUS = {
    QUEUED: 'queued',       // File selected, waiting to upload
    UPLOADING: 'uploading', // Currently uploading
    PROCESSING: 'processing', // Backend processing (PDF→JSON)
    READY: 'ready',         // Ready for editing
    INGESTING: 'ingesting', // Being ingested to vector DB
    COMPLETED: 'completed', // Ingestion complete
    INGESTED: 'ingested',   // In ingested files section
    ERROR: 'error',         // Upload/processing failed
};

// Content View Modes
export const CONTENT_TYPE = {
    EDITOR: 'editor',       // Edit mode (pages/items)
    EMBEDDING: 'embedding', // View stored embeddings
};
```

---

## State Management

### State Categories in IngestionPage.jsx

#### 1. Upload Queue State
| State | Type | Purpose |
|-------|------|---------|
| `uploadQueue` | Array | List of files with `{documentId, filename, status}` |
| `selectedDocumentId` | string | Currently selected file ID |
| `isDragging` | boolean | Drag-over visual state |

#### 2. Document Content State
| State | Type | Purpose |
|-------|------|---------|
| `documentState` | Object | Current document `{filename, pages: [{pageNumber, items}]}` |
| `currentPage` | number | Active page number (1-indexed) |
| `hasUnsavedChanges` | boolean | Dirty flag for save prompt |
| `isEditingTitle` | boolean | Title edit mode active |
| `editingTitleValue` | string | Temp title value during edit |

#### 3. UI Panel State
| State | Type | Purpose |
|-------|------|---------|
| `leftSidebarCollapsed` | boolean | File queue collapsed |
| `rightSidebarCollapsed` | boolean | Helpers collapsed |
| `rightSidebarStateBeforePreview` | boolean | Saved state for preview mode |

#### 4. Preview & Ingestion State
| State | Type | Purpose |
|-------|------|---------|
| `isPreviewMode` | boolean | Showing embedding preview |
| `isLoadingPreview` | boolean | Generating preview |
| `embeddingPreview` | Object | Preview data `{chunks: [...]}` |
| `previewConfig` | Object | `{targetDb, strategy}` |
| `previewDocumentIds` | Set | Files in multi-file preview |
| `isIngesting` | boolean | Ingestion in progress |
| `ingestionProgress` | number | 0-100 progress |

#### 5. Multi-Select State
| State | Type | Purpose |
|-------|------|---------|
| `multiSelectMode` | boolean | Multi-select toggle |
| `checkedDocumentIds` | Set | Selected file IDs |

#### 6. Helper State
| State | Type | Purpose |
|-------|------|---------|
| `runningHelper` | string | Currently running helper ID |
| `pendingHelper` | Object | Helper awaiting file selection |
| `showHelperFileModal` | boolean | File selection modal open |
| `showRegexModal` | boolean | Regex input modal open |

#### 7. Modal State
| State | Type | Purpose |
|-------|------|---------|
| `showIngestionModal` | boolean | Ingestion config modal |
| `showCacheManagement` | boolean | Cache management modal |

#### 8. Content Type State
| State | Type | Purpose |
|-------|------|---------|
| `contentType` | CONTENT_TYPE | EDITOR or EMBEDDING |
| `storedEmbeddings` | Object | Cached embeddings for ingested file |
| `ingestedFilesList` | Array | List from localStorage |

### Hooks Used

| Hook | Source | Purpose |
|------|--------|---------|
| `useCommandHistory` | Custom | Undo/redo with command pattern |
| `useLocalCache` | Custom | localStorage persistence |
| `useBackendConfig` | Custom | Fetch backend config on mount |

---

## User Interaction Modes

### Mode 1: File Upload Mode
**When**: Initial state or no file selected

**User Actions**:
1. **Drag & Drop** - Drop PDF files onto UploadZone
2. **Click to Browse** - Click upload zone to open file picker

**State Transitions**:
- `QUEUED` → `UPLOADING` → `PROCESSING` → `READY`

### Mode 2: Content Editing Mode
**When**: A READY file is selected, `contentType === EDITOR`

**User Actions**:
| Action | Component | Result |
|--------|-----------|--------|
| Click text | TextItem | Enter edit mode (textarea) |
| Click image badge | ImageItem | Change classification |
| Click image | ImageItem | Open lightbox |
| Click 🗑️ Delete | TextItem/ImageItem/TableItem | Soft delete (undoable) |
| Click Restore | Deleted item | Restore item |
| Click page arrows | PageNavigation | Navigate pages |
| Click filename | Header | Enter title edit mode |
| Ctrl+Z | Keyboard | Undo |
| Ctrl+Shift+Z | Keyboard | Redo |
| Click Save | SaveBar | Save to localStorage |
| Click Ingest | SaveBar | Open ingestion modal |

### Mode 3: Helper Execution Mode
**When**: Running an AI helper function

**User Actions**:
1. Click helper button in HelperPanel
2. (For backend helpers) Select target files in modal
3. Wait for processing

**Helpers Available**:
| Helper | Type | Effect |
|--------|------|--------|
| Remove All Logos | Local | Delete images with `classification: 'logo'` |
| Remove Empty Text | Local | Delete whitespace-only text items |
| Delete by Regex | Local | Delete text matching regex pattern |
| AI Image Descriptions | Backend | Generate descriptions for all images |

### Mode 4: Preview Mode
**When**: `isPreviewMode === true`

**Visual Changes**:
- Right sidebar hidden
- SaveBar hidden
- Main area shows `EmbeddingPreviewViewer`
- File queue shows preview indicator on selected files

**User Actions**:
| Action | Component | Result |
|--------|-----------|--------|
| Click ✓ Confirm | EmbeddingPreviewViewer | Ingest and save embeddings |
| Click ✕ Cancel | EmbeddingPreviewViewer | Exit preview mode |
| Navigate chunks | Pagination | View different embedding chunks |

### Mode 5: Embedding View Mode
**When**: `contentType === EMBEDDING` (ingested file selected)

**Visual Changes**:
- Shows read-only `EmbeddingPreviewViewer`
- No helpers sidebar
- No edit functionality

### Mode 6: Multi-Select Mode
**When**: `multiSelectMode === true`

**Visual Changes**:
- Checkboxes appear on file queue items
- "Multi-Select" button highlighted

**User Actions**:
| Action | Result |
|--------|--------|
| Toggle checkbox | Add/remove from `checkedDocumentIds` |
| Click "Multi-Select" button | Toggle mode on/off |
| Run helper | Applies to all selected files |

---

## Backend API Triggers

### API Endpoints (via `ingestionApi.js`)

| Endpoint | Method | Trigger | Payload |
|----------|--------|---------|---------|
| `/api/ingestion/config` | GET | Page mount | - |
| `/api/ingestion/upload` | POST | File drop/select | `FormData(file)` |
| `/api/ingestion/ingest` | POST | Preview confirm | `{targetDb, embeddingPreview, strategy}` |
| `/api/ingestion/helper` | POST | Backend helper run | `{helperId, content, params}` |

> **Note**: `previewEmbeddings` is now a **frontend-only** operation (pure data transformation, no backend call).

### Trigger Flow 1: Upload Document
```
User Action: Drop PDF file on UploadZone
     │
     ▼
handleFilesSelected(files)
     │
     ├─► Add to uploadQueue with status: QUEUED
     │
     ▼
processUploadQueue() (useEffect)
     │
     ├─► Set status: UPLOADING
     │
     ▼
uploadDocument(file) ◄────────────────── BACKEND CALL
     │
     ├─► Response: {success, filename, content: {pages: [...]}}
     │
     ▼
saveUploadedFile(documentId, metadata)  ◄─ localStorage
saveFileContent(documentId, content)     ◄─ localStorage
     │
     ▼
Set status: READY
```

### Trigger Flow 2: Run Backend Helper
```
User Action: Click "AI Image Descriptions" in HelperPanel
     │
     ▼
handleRunHelper('ai_image_descriptions')
     │
     ├─► Check if backend helper → Show file select modal
     │
     ▼
User Action: Select files → Confirm
     │
     ▼
executeHelperOnFiles([documentIds])
     │
     ├─► Load each document from localStorage
     │
     ▼
runBackendHelper('ai_image_descriptions', content) ◄── BACKEND CALL
     │
     ├─► Response: {modifiedItems: [{id, description}], message}
     │
     ▼
executeCommand(Commands.batchUpdate(changes))
setHasUnsavedChanges(true)
```

### Trigger Flow 3: Preview Embeddings (Frontend-Only)
```
User Action: Click "Ingest" → Select strategy → Confirm
     │
     ▼
handleStartIngestion(targetDb, strategy)
     │
     ├─► setIsPreviewMode(true)
     │
     ▼
generateEmbeddingPreview(documentState, strategy) ◄── LOCAL (no backend)
     │
     ├─► Pure data transformation:
     │   - Filter deleted items
     │   - Merge text items per page/strategy
     │   - Collect images
     │   - Format as chunks
     │
     ├─► Returns: {chunks: [{id, text, metadata, images}]}
     │
     ▼
setEmbeddingPreview(preview)
```

> **Why frontend?** This is pure data restructuring with no AI or external services needed.
> The frontend already has the documentState in memory, so sending it to backend
> just to restructure and send back adds unnecessary latency.

### Trigger Flow 4: Confirm Ingestion
```
User Action: Click "✓ Confirm" in preview
     │
     ▼
handleConfirmIngestion()
     │
     ├─► Simulated delay (1 second)
     ├─► convertPreviewToIngestedFormat(embeddingPreview)
     │
     ▼
markFileAsIngested(documentId, ingestedData)  ◄─ localStorage
clearCache(editStateKey)                       ◄─ localStorage
     │
     ▼
Update uploadQueue → Remove document
Update ingestedFilesList → Add document
setIsPreviewMode(false)
```

---

## Component Reference

### UploadZone.jsx
**Purpose**: Drag-drop file upload area

**Props**:
```javascript
{
  onFilesSelected: (files: FileList) => void,
  disabled: boolean,
  isDragging: boolean,
  onDragOver: (e) => void,
  onDragLeave: (e) => void,
  onDrop: (e) => void,
}
```

**Validation**: Uses `INGESTION_CONFIG.upload` for file size/type limits

---

### FileQueue.jsx
**Purpose**: Display uploaded and ingested files

**Props**:
```javascript
{
  files: Array<{documentId, filename, status}>,
  ingestedFiles: Array,
  selectedDocumentId: string,
  checkedDocumentIds: Set,
  onSelect: (documentId) => void,
  onCheck: (documentId) => void,
  multiSelectMode: boolean,
  isPreviewMode: boolean,
  previewDocumentIds: Set,
  onRemoveFromPreview: (documentId) => void,
  onRemoveFromContent: (documentId) => void,
  showIngestedSection: boolean,
}
```

**Sections**:
1. Upload Queue (active files)
2. Ingested Files (completed, green indicator)

---

### ContentViewer.jsx
**Purpose**: Main content display with page navigation

**Props**:
```javascript
{
  document: {filename, pages: [{pageNumber, items}]},
  currentPage: number,
  onPageChange: (page) => void,
  onEditItem: (itemId, newContent) => void,
  onDeleteItem: (itemId) => void,
  onRestoreItem: (itemId) => void,
  onClassChange: (itemId, newClass) => void,
  availableClasses: string[],
}
```

**Children**: `PageContent` + `PageNavigation`

---

### TextItem.jsx
**Purpose**: Editable markdown text block

**Features**:
- Click to edit (notebook-cell style)
- Markdown preview via `react-markdown`
- Auto-resize textarea
- Keyboard shortcuts: Ctrl+Enter (save), Escape (cancel)
- Soft delete with restore

**Props**:
```javascript
{
  item: {id, type: 'text', content, deleted},
  onEdit: (itemId, newContent) => void,
  onDelete: (itemId) => void,
  onRestore: (itemId) => void,
}
```

---

### ImageItem.jsx
**Purpose**: Display image with classification controls

**Features**:
- Classification badge (dropdown)
- Lightbox expand
- Auto-resize for large images
- Soft delete with restore

**Props**:
```javascript
{
  item: {id, type: 'image', imageUrl, classification, deleted, imageWidth, imageHeight},
  onDelete: (itemId) => void,
  onRestore: (itemId) => void,
  onClassChange: (itemId, newClass) => void,
  availableClasses: string[],
}
```

---

### TableItem.jsx
**Purpose**: Read-only table display

**Features**:
- Styled table with headers/rows
- Soft delete with restore

**Props**:
```javascript
{
  item: {id, type: 'table', tableData: {headers, rows}, deleted},
  onDelete: (itemId) => void,
  onRestore: (itemId) => void,
}
```

---

### HelperPanel.jsx
**Purpose**: Sidebar with helper function buttons

**Configuration**: Loaded from `INGESTION_CONFIG.helpers`

**Helper Types**:
- `local`: Execute in frontend (no backend call)
- `backend`: Require backend API call

**Props**:
```javascript
{
  onRunHelper: (helperId) => void,
  disabled: boolean,
  runningHelper: string | null,
}
```

---

### SaveBar.jsx
**Purpose**: Action bar with undo/redo/save/ingest

**Props**:
```javascript
{
  hasUnsavedChanges: boolean,
  onSave: () => void,
  canUndo: boolean,
  canRedo: boolean,
  onUndo: () => void,
  onRedo: () => void,
  onIngest: () => void,
  canIngest: boolean,
}
```

**Buttons**:
- Undo (↩️) - disabled if !canUndo
- Redo (↪️) - disabled if !canRedo
- Save - disabled if !hasUnsavedChanges
- Ingest - opens IngestionModal

---

### EmbeddingPreviewViewer.jsx
**Purpose**: Display embedding preview or stored embeddings

**Props**:
```javascript
{
  preview: {chunks: [{id, text, metadata, images}]},
  isLoading: boolean,
  onCancel: () => void,
  onConfirm: () => void,
  onConfirmAll: () => void,  // For multi-file
  isMultiFile: boolean,
  totalFilesInPreview: number,
  readOnly: boolean,  // For viewing stored embeddings
}
```

**Features**:
- Paginated chunk display
- Image gallery per chunk
- Cancel/Confirm buttons (hidden in readOnly)

---

### IngestionModal.jsx
**Purpose**: Select target DB and ingestion strategy

**Strategies**:
| Strategy | Description | Status |
|----------|-------------|--------|
| `embed_per_page` | One embedding per page | ✅ Enabled |
| `chunked_document` | Chunked by token limit | ✅ Enabled |
| `semantic_sections` | AI-detected sections | ⏳ Coming Soon |
| `hierarchical` | Multi-level embeddings | ⏳ Coming Soon |
| `knowledge_graph` | Entity-relationship | ⏳ Coming Soon |
| `custom` | User-defined rules | ⏳ Coming Soon |

**Props**:
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  onShowPreview: (targetDb, strategy) => void,
  backendConfig: {availableDatabases, ...},
  isIngesting: boolean,
  progress: number,
}
```

---

### CacheManagement.jsx
**Purpose**: View and clear localStorage cache

**Cache Types**:
- `editor`: Current edit state
- `uploaded`: Uploaded file metadata
- `content`: Per-file content
- `embedding`: Per-file embeddings

**Features**:
- List cached items with size
- Select individual items
- Clear selected or all

---

### HelperFileSelectModal.jsx
**Purpose**: Select files for backend helper execution

**Features**:
- Multi-select file list
- "Apply to Current File Only" shortcut
- Only shows READY files

---

## Data Flow Diagrams

### Upload to Ready Flow
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  QUEUED  │────►│UPLOADING │────►│PROCESSING│────►│  READY   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                 │                │
     │                │                 │                │
     ▼                ▼                 ▼                ▼
  Add to          Upload to        Backend PDF      Save to
  queue           backend          extraction      localStorage
```

### Edit to Ingest Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   EDITING   │────►│  PREVIEW    │────►│  INGESTING  │────►│  INGESTED   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
  Edit items,         Preview            Confirm &            Move to
  run helpers        embeddings          simulate           ingested list
```

### Command Pattern (Undo/Redo)
```
┌─────────────────────────────────────────────────────────┐
│                   useCommandHistory                      │
├─────────────────────────────────────────────────────────┤
│  Commands:                                              │
│  • deleteItem(itemId)     → Marks item.deleted = true   │
│  • restoreItem(itemId)    → Marks item.deleted = false  │
│  • updateItem(itemId, changes)  → Updates item props    │
│  • batchDelete([itemIds]) → Marks multiple as deleted   │
│  • batchUpdate([changes]) → Updates multiple items      │
│  • renameDocument(newName)→ Updates filename            │
├─────────────────────────────────────────────────────────┤
│  Operations:                                            │
│  • executeCommand(cmd)    → Execute and push to undo    │
│  • undo()                 → Pop from undo, push to redo │
│  • redo()                 → Pop from redo, push to undo │
│  • canUndo, canRedo       → Boolean flags               │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Steps to Trigger Each Feature

### Upload a Document
1. Drag PDF file onto upload zone (or click to browse)
2. Wait for "Processing..." status
3. File appears as "Ready" in queue

### Edit Text Content
1. Select a READY file from queue
2. Click on any text block
3. Edit in textarea
4. Press Ctrl+Enter to save or Escape to cancel
5. Click "Save" in SaveBar to persist

### Delete/Restore Items
1. Hover over any item
2. Click 🗑️ Delete button
3. Item shows as "Deleted" with strikethrough
4. Click "Restore" to undo deletion
5. Or use Ctrl+Z for undo

### Run AI Helper
1. Select a READY file
2. Click "AI Image Descriptions" in right sidebar
3. Choose files in modal
4. Wait for processing
5. Images now have descriptions

### Ingest to Vector DB
1. Click "Ingest" button in SaveBar
2. Select target database
3. Choose strategy (embed_per_page or chunked_document)
4. Click "Preview"
5. Review embedding chunks
6. Click "✓ Confirm"
7. File moves to "Ingested" section

### Manage Cache
1. Click "Manage Cache" at bottom of file queue
2. Select items to clear
3. Click "Clear Selected" or "Clear All"
