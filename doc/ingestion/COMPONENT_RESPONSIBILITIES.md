# Ingestion Component Responsibilities

This document describes the responsibilities of each component in the Ingestion Page feature.

## Architecture Overview

The architecture uses **Connected Components** that own their business logic and communicate via shared context. The page component is layout-only.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            IngestionPage                                     │
│              (Layout-only: ~550 lines, no business logic)                   │
│  ┌─────────────────┐  ┌─────────────────────────┐  ┌─────────────────┐     │
│  │  LeftSidebar    │  │     Main Content        │  │  RightSidebar   │     │
│  │  ┌───────────┐  │  │  ┌───────────────────┐  │  │  ┌───────────┐  │     │
│  │  │Connected  │  │  │  │Connected          │  │  │  │Connected  │  │     │
│  │  │UploadZone │  │  │  │ContentViewer      │  │  │  │HelperPanel│  │     │
│  │  └───────────┘  │  │  │(owns edit logic)  │  │  │  │(owns run  │  │     │
│  │  ┌───────────┐  │  │  └───────────────────┘  │  │  │logic)     │  │     │
│  │  │Connected  │  │  │  ┌───────────────────┐  │  │  └───────────┘  │     │
│  │  │FileQueue  │  │  │  │EmbeddingViewer    │  │  │                 │     │
│  │  │(owns sel) │  │  │  │(pure UI)          │  │  │                 │     │
│  │  └───────────┘  │  │  └───────────────────┘  │  │                 │     │
│  └─────────────────┘  └─────────────────────────┘  └─────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                           Modals (Pure UI)                          │    │
│  │  IngestionModal | RegexModal | CacheManagement | HelperFileSelect  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                         ┌─────────────────────┐
                         │  IngestionProvider  │
                         │  ┌───────────────┐  │
                         │  │ingestionReducer│ │
                         │  │ (central state)│ │
                         │  └───────────────┘  │
                         │  Split Contexts:    │
                         │  • FileQueueContext │
                         │  • DocumentContext  │
                         │  • PreviewContext   │
                         │  • UIContext        │
                         │  • DispatchContext  │
                         └─────────────────────┘
```

## Component Classification

### Connected Components (Own Business Logic)

These components subscribe to context and dispatch actions. They own their business logic.
**Location**: `components/ingestion/`

| Component | File | Responsibility |
|-----------|------|----------------|
| `ConnectedFileQueue` | `ConnectedFileQueue.jsx` | File selection, check, removal |
| `ConnectedUploadZone` | `ConnectedUploadZone.jsx` | File upload, validation, caching |
| `ConnectedContentViewer` | `ConnectedContentViewer.jsx` | Page nav, item edit/delete/restore |
| `ConnectedHelperPanel` | `ConnectedHelperPanel.jsx` | Helper execution, regex trigger |

### Pure UI Components (Receive Props)

These components have no context dependency. They receive props and emit events.

| Component | File | Responsibility |
|-----------|------|----------------|
| `FileQueueItem` | `components/ingestion/FileQueueItem.jsx` | Single file display with loading state |
| `PageContent` | `components/ingestion/PageContent.jsx` | Render page items |
| `TextItem` | `components/ingestion/TextItem.jsx` | Editable text item |
| `ImageItem` | `components/ingestion/ImageItem.jsx` | Image with description |
| `TableItem` | `components/ingestion/TableItem.jsx` | Table display |
| `IngestionModal` | `components/ingestion/IngestionModal.jsx` | Ingestion config |
| `RegexInputModal` | `components/ingestion/RegexInputModal.jsx` | Regex pattern input |

## Component Hierarchy

```
IngestionPage (entry point)
└── IngestionProvider (context provider)
    └── IngestionPage (layout-only: ~550 lines)
        ├── LeftSidebar
        │   ├── ConnectedUploadZone (owns upload logic)
        │   ├── ConnectedFileQueue (owns selection logic)
        │   │   └── FileQueueItem (pure UI) ×N
        │   └── CacheManagement (pure UI)
        ├── Main Content
        │   ├── ConnectedContentViewer (owns edit logic)
        │   │   ├── PageNavigation (pure UI)
        │   │   └── PageContent (pure UI)
        │   │       ├── TextItem (pure UI) ×N
        │   │       ├── ImageItem (pure UI) ×N
        │   │       └── TableItem (pure UI) ×N
        │   └── EmbeddingPreviewViewer (pure UI)
        │       └── EmbeddingPreview (pure UI) ×N
        ├── RightSidebar
        │   └── ConnectedHelperPanel (owns helper logic)
        └── Modals (pure UI)
            ├── IngestionModal
            ├── RegexInputModal
            └── HelperFileSelectModal
```

## Detailed Component Responsibilities

### Layout Component

#### `IngestionPage`
**File**: `frontend/src/pages/IngestionPage.jsx`

**Responsibility**: Layout-only orchestrator (~550 lines)

| Aspect | Description |
|--------|-------------|
| **Role** | Render three-panel layout, toggle sidebars, render modals |
| **State Access** | UI state for layout (collapsed, activeModal) |
| **Business Logic** | NONE - delegated to Connected components |
| **Shared Resources** | Passes `executeCommand` to children for undo/redo |
| **Children** | Connected* components, pure UI modals |

---

### Connected Components (Own Business Logic)

#### `ConnectedFileQueue`
**File**: `frontend/src/components/ingestion/ConnectedFileQueue.jsx`

**Responsibility**: File queue with selection, removal, and preview switching logic

| Aspect | Description |
|--------|-------------|
| **Hooks Used** | `useFileQueue`, `usePreview`, `useUI`, `useIngestionActions` |
| **Business Logic** | File selection, multi-select, checking, removal, preview file switching |
| **API Calls** | `previewEmbeddings()` (when switching preview files) |
| **Events Handled** | Click to select (switches preview in preview mode), checkbox toggle, remove button |
| **Local State** | `switchingToDocId` - tracks loading state during preview switch |

---

#### `ConnectedUploadZone`
**File**: `frontend/src/components/ingestion/ConnectedUploadZone.jsx`

**Responsibility**: File upload with validation and processing

| Aspect | Description |
|--------|-------------|
| **Hooks Used** | `useUI`, `usePreview`, `useFileQueue`, `useIngestionActions` |
| **Business Logic** | File validation, upload API call, cache storage |
| **API Calls** | `uploadDocument()` |
| **Events Handled** | File drop, file select, drag enter/leave |

---

#### `ConnectedContentViewer`
**File**: `frontend/src/components/ingestion/ConnectedContentViewer.jsx`

**Responsibility**: Document viewer with editing capabilities

| Aspect | Description |
|--------|-------------|
| **Hooks Used** | `useDocument`, `useIngestionActions`, `useBackendConfig` |
| **Props** | `commandState`, `executeCommand`, `undo`, `redo` |
| **Business Logic** | Page navigation, item edit/delete/restore/classify |
| **Commands Used** | `Commands.edit`, `Commands.delete`, `Commands.restore` |

---

#### `ConnectedHelperPanel`
**File**: `frontend/src/components/ingestion/ConnectedHelperPanel.jsx`

**Responsibility**: Helper panel with execution logic

| Aspect | Description |
|--------|-------------|
| **Hooks Used** | `useUI`, `useDocument`, `useIngestionActions` |
| **Props** | `executeCommand` |
| **Business Logic** | Helper execution, batch operations |
| **API Calls** | `runBackendHelper()` |
| **Modals Triggered** | `MODAL_TYPES.REGEX`, `MODAL_TYPES.HELPER_FILE_SELECT` |

---

### Pure UI Components
| **Validation** | Clamps page to valid range |

---

#### `PageContent`
**File**: `frontend/src/components/ingestion/PageContent.jsx`

**Responsibility**: Render a single page's content items

| Aspect | Description |
|--------|-------------|
| **Role** | Maps page items to appropriate item components |
| **Props** | Page data, edit handlers, available classes |
| **Children** | `TextItem`, `ImageItem`, `TableItem` based on item type |

---

#### `TextItem`
**File**: `frontend/src/components/ingestion/TextItem.jsx`

**Responsibility**: Editable text content item

| Aspect | Description |
|--------|-------------|
| **Role** | Display/edit text, delete/restore functionality |
| **Props** | Item data, `onEdit`, `onDelete`, `onRestore` |
| **UI State** | Edit mode, deleted visual state |

---

#### `ImageItem`
**File**: `frontend/src/components/ingestion/ImageItem.jsx`

**Responsibility**: Image content item with classification

| Aspect | Description |
|--------|-------------|
| **Role** | Display image, classification dropdown, delete/restore |
| **Props** | Item data, available classes, `onClassChange`, `onDelete`, `onRestore` |
| **UI State** | Deleted visual state |

---

#### `TableItem`
**File**: `frontend/src/components/ingestion/TableItem.jsx`

**Responsibility**: Table content item

| Aspect | Description |
|--------|-------------|
| **Role** | Render tabular data, delete/restore functionality |
| **Props** | Item data, `onDelete`, `onRestore` |
| **UI State** | Deleted visual state |

---

### Preview Components

#### `EmbeddingPreviewViewer`
**File**: `frontend/src/components/ingestion/EmbeddingPreviewViewer.jsx`

**Responsibility**: Display embedding preview or stored embeddings

| Aspect | Description |
|--------|-------------|
| **Role** | Renders embedding chunks, action buttons (confirm/cancel) |
| **Props** | Preview data, loading state, handlers, read-only flag |
| **Modes** | Preview (with actions), Read-only (stored embeddings) |
| **Children** | `EmbeddingPreview` (×N chunks) |

---

#### `EmbeddingPreview`
**File**: `frontend/src/components/ingestion/EmbeddingPreview.jsx`

**Responsibility**: Single embedding chunk display

| Aspect | Description |
|--------|-------------|
| **Role** | Display chunk text, metadata, and associated images |
| **Props** | Chunk data (id, text, metadata, images) |
| **Collapsible** | Long text can be expanded |

---

### Helper Components

#### `HelperPanel`
**File**: `frontend/src/components/ingestion/HelperPanel.jsx`

**Responsibility**: Document helper tools panel

| Aspect | Description |
|--------|-------------|
| **Role** | Lists available helpers, triggers helper execution |
| **Props** | `onRunHelper`, `disabled`, `runningHelper` |
| **Helpers** | Remove logos, Remove empty, Delete by regex, AI descriptions |
| **UI State** | Disabled state, running indicator |

---

### Modal Components

#### `IngestionModal`
**File**: `frontend/src/components/ingestion/IngestionModal.jsx`

**Responsibility**: Configure and start ingestion

| Aspect | Description |
|--------|-------------|
| **Role** | Select target database and embedding strategy |
| **Props** | `isOpen`, `onClose`, `onShowPreview`, `backendConfig` |
| **Inputs** | Database dropdown, Strategy dropdown |
| **Actions** | Preview, Cancel |

---

#### `RegexInputModal`
**File**: `frontend/src/components/ingestion/RegexInputModal.jsx`

**Responsibility**: Input regex pattern for deletion

| Aspect | Description |
|--------|-------------|
| **Role** | Collect regex pattern from user |
| **Props** | `isOpen`, `onClose`, `onConfirm` |
| **Validation** | Tests pattern validity |

---

#### `CacheManagement`
**File**: `frontend/src/components/ingestion/CacheManagement.jsx`

**Responsibility**: Manage localStorage cache

| Aspect | Description |
|--------|-------------|
| **Role** | View cache usage, clear specific cache types |
| **Props** | `onClose`, `onCacheCleared` |
| **Actions** | Clear uploaded, Clear embeddings, Clear all |
| **Clear All Behavior** | Clears both uploadQueue AND ingestedFiles from sidebar via `actions.clearAllFiles()` |

---

#### `HelperFileSelectModal`
**File**: `frontend/src/components/ingestion/HelperFileSelectModal.jsx`

**Responsibility**: Select files for helper execution

| Aspect | Description |
|--------|-------------|
| **Role** | Multi-select files to apply helper to |
| **Props** | `isOpen`, `onClose`, `onConfirm`, `files`, `helper` |
| **Default Selection** | Current document if available |

---

### Action Components

#### `SaveBar`
**File**: `frontend/src/components/ingestion/SaveBar.jsx`

**Responsibility**: Undo/redo and ingest actions

| Aspect | Description |
|--------|-------------|
| **Role** | Action buttons for document operations |
| **Props** | `canUndo`, `canRedo`, `onUndo`, `onRedo`, `onIngest`, `canIngest` |
| **Buttons** | Undo, Redo, Ingest |

---

## Data Flow

### Upload Flow
```
User drops file → ConnectedUploadZone
    → handleFilesSelected (owns logic)
    → actions.startFileUpload() → reducer → state.fileQueue.uploadQueue
    → uploadDocument API call
    → actions.completeFileUpload() → reducer
    → ConnectedFileQueue re-renders via useFileQueue hook
```

### Edit Flow
```
User edits text → TextItem.onEdit (pure UI callback)
    → ConnectedContentViewer.handleEditItem (owns logic)
    → executeCommand(Commands.editItem)
    → useCommandHistory → new documentState
    → actions.modifyDocument() → reducer → state.document
    → ConnectedContentViewer re-renders via useDocument hook
```

### Ingestion Flow
```
User clicks Ingest → IngestionModal.onShowPreview (pure UI)
    → IngestionPage.handleShowPreview (modal handler)
    → actions.startPreview() → reducer → state.preview, state.ui
    → API call → actions.setPreviewGenerated()
    → EmbeddingPreviewViewer renders
    → User clicks Confirm → handleConfirmIngestion
    → actions.completeIngestion() → reducer → ALL domains updated
```

## Context Subscriptions (New Architecture)

| Component | useFileQueue | useDocument | usePreview | useUI | useIngestionActions |
|-----------|:------------:|:-----------:|:----------:|:-----:|:-------------------:|
| **IngestionPage** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ConnectedFileQueue** | ✓ | - | ✓ | ✓ | ✓ |
| **ConnectedUploadZone** | ✓ | - | ✓ | ✓ | ✓ |
| **ConnectedContentViewer** | - | ✓ | - | - | ✓ |
| **ConnectedHelperPanel** | - | ✓ | - | ✓ | ✓ |
| FileQueueItem | (props) | - | - | - | - |
| PageContent | - | (props) | - | - | - |
| TextItem/ImageItem | - | (props) | - | - | - |
| Modals | (props) | - | - | - | - |

**Note**: Connected components subscribe directly to context, while pure UI components receive data via props. This distributes business logic while keeping UI components reusable.

## Benefits of New Architecture

1. **Distributed Logic**: Business logic is in Connected components, not a "God Class"
2. **Fine-Grained Re-renders**: Components only re-render when their subscribed domain changes
3. **Testable**: Connected components can be tested with mocked context
4. **Traceable**: All state changes visible in reducer (see `REDUCER.md`)
5. **Standard React**: Familiar patterns, works with React DevTools

## Future Optimizations

1. **Memoization**: Add `React.memo` to expensive pure UI components
2. **Virtualization**: For large file lists, use virtualized scrolling
3. **Code Splitting**: Lazy load modal components
