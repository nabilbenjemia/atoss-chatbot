# Ingestion Component Responsibilities

This document describes the responsibilities of each component in the Ingestion Page feature.

## Architecture Overview

The refactored architecture uses **Connected Components** that own their business logic and communicate via shared context. The page component is now layout-only.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IngestionPageLayout                                  │
│              (Layout-only: ~250 lines, no business logic)                   │
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

| Component | File | Responsibility |
|-----------|------|----------------|
| `ConnectedFileQueue` | `components/ingestion/ConnectedFileQueue.jsx` | File selection, check, removal |
| `ConnectedUploadZone` | `components/ingestion/ConnectedUploadZone.jsx` | File upload, validation, caching |
| `ConnectedContentViewer` | `components/ingestion/ConnectedContentViewer.jsx` | Page nav, item edit/delete/restore |
| `ConnectedHelperPanel` | `components/ingestion/ConnectedHelperPanel.jsx` | Helper execution, regex trigger |

### Pure UI Components (Receive Props)

These components have no context dependency. They receive props and emit events.

| Component | File | Responsibility |
|-----------|------|----------------|
| `FileQueueItem` | `components/ingestion/FileQueueItem.jsx` | Single file display |
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
    └── IngestionPageLayout (layout-only: ~250 lines)
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

#### `IngestionPageLayout`
**File**: `frontend/src/pages/IngestionPageLayout.jsx`

**Responsibility**: Layout-only orchestrator (~250 lines)

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

**Responsibility**: File queue with selection and removal logic

| Aspect | Description |
|--------|-------------|
| **Hooks Used** | `useFileQueue`, `usePreview`, `useUI`, `useIngestionActions` |
| **Business Logic** | File selection, multi-select, checking, removal |
| **API Calls** | None (cache utilities for file content) |
| **Events Handled** | Click to select, checkbox toggle, remove button |

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
User drops file → UploadZone.onFilesSelected
    → IngestionPageContent.handleFilesSelected
    → actions.startFileUpload() → reducer → state.fileQueue.uploadQueue
    → API call → actions.completeFileUpload() → reducer
    → FileQueue re-renders with new file
```

### Edit Flow
```
User edits text → TextItem.onEdit
    → IngestionPageContent.handleEditItem
    → executeCommand(Commands.editItem)
    → useCommandHistory → new documentState
    → actions.modifyDocument() → reducer → state.document
    → ContentViewer re-renders
```

### Ingestion Flow
```
User clicks Ingest → IngestionModal.onShowPreview
    → IngestionPageContent.handleStartIngestion
    → actions.startPreview() → reducer → state.preview, state.ui
    → API call → actions.setPreviewGenerated()
    → EmbeddingPreviewViewer renders
    → User clicks Confirm → handleConfirmIngestion
    → actions.completeIngestion() → reducer → ALL domains updated
```

## Context Subscriptions

| Component | useFileQueue | useDocument | usePreview | useUI | useDispatch |
|-----------|:------------:|:-----------:|:----------:|:-----:|:-----------:|
| IngestionPageContent | ✓ | ✓ | ✓ | ✓ | ✓ |
| LeftSidebar | - | - | - | - | - |
| FileQueue | (props) | - | - | - | - |
| ContentHeader | - | (props) | - | - | - |
| ContentViewer | - | (props) | - | - | - |
| RightSidebar | - | - | - | - | - |
| HelperPanel | - | - | - | (props) | - |

**Note**: Most child components receive data via props from `IngestionPageContent`, which subscribes to all contexts. This is intentional as it allows `IngestionPageContent` to coordinate cross-domain operations.

## Future Optimizations

1. **Deeper Context Usage**: Move context subscriptions closer to leaf components that need specific state
2. **Memoization**: Add `React.memo` to expensive render components
3. **Virtualization**: For large file lists, use virtualized scrolling
4. **Code Splitting**: Lazy load modal components
