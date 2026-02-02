# Ingestion Page State Machine

> **Last Updated**: 2026-01-29

This document models the state machines for the IngestionPage and its connected components. The architecture uses a **central reducer** with **split contexts** for different state domains.

## Table of Contents
1. [Overview](#overview)
2. [Global State Domains](#global-state-domains)
3. [Page-Level State Machine](#page-level-state-machine)
4. [Component State Machines](#component-state-machines)
5. [Cross-Component Transitions](#cross-component-transitions)
6. [State Transition Matrix](#state-transition-matrix)

---

## Overview

The IngestionPage uses a **hierarchical state machine** where:
- **Global state** is managed by `ingestionReducer.js` and split into 4 domains
- **Component state** is derived from global state + local state (e.g., `switchingToDocId`)
- **Transitions** are triggered by actions dispatched to the reducer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IngestionPage                                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Global State (Reducer)                         │  │
│  │  ┌────────────┬────────────┬────────────┬────────────┐               │  │
│  │  │ FileQueue  │  Document  │  Preview   │     UI     │               │  │
│  │  │  Domain    │   Domain   │   Domain   │   Domain   │               │  │
│  │  └────────────┴────────────┴────────────┴────────────┘               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│  ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐   │
│  │ Connected   │           │  Connected    │          │  Connected    │   │
│  │ FileQueue   │           │ContentViewer  │          │ HelperPanel   │   │
│  │ ┌─────────┐ │           │               │          │               │   │
│  │ │ Local:  │ │           │               │          │               │   │
│  │ │switching│ │           │               │          │               │   │
│  │ │ToDocId  │ │           │               │          │               │   │
│  │ └─────────┘ │           │               │          │               │   │
│  └─────────────┘           └───────────────┘          └───────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Global State Domains

### 1. FileQueue Domain

Manages files in the upload queue and ingested files list.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FileQueue Domain                              │
│                                                                     │
│  uploadQueue: [                                                     │
│    { id, documentId, filename, status, progress, error }            │
│  ]                                                                  │
│                                                                     │
│  ingestedFiles: [                                                   │
│    { ingestedId, documentId, filename, strategy, timestamp }        │
│  ]                                                                  │
│                                                                     │
│  selectedDocumentId: string | null                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Document Domain

Manages current document content and editing state.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Document Domain                               │
│                                                                     │
│  documentState: {                                                   │
│    filename, documentId, pages: [{ pageNumber, items: [...] }]      │
│  } | null                                                           │
│                                                                     │
│  currentPage: number (1-indexed)                                    │
│  contentType: 'editor' | 'embedding'                                │
│  storedEmbeddings: object | null                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Preview Domain

Manages embedding preview state.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Preview Domain                               │
│                                                                     │
│  isPreviewMode: boolean                                             │
│  isLoadingPreview: boolean                                          │
│  embeddingPreview: object | null                                    │
│  previewConfig: { targetDb, strategy }                              │
│  previewDocumentIds: Set<string>                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. UI Domain

Manages UI state (sidebars, modals, modes).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UI Domain                                  │
│                                                                     │
│  mode: 'editing' | 'preview' | 'readonly'                           │
│  leftSidebarCollapsed: boolean                                      │
│  rightSidebarCollapsed: boolean                                     │
│  rightSidebarStateBeforePreview: boolean                            │
│  isDragging: boolean                                                │
│  multiSelectMode: boolean                                           │
│  checkedDocumentIds: Set<string>                                    │
│  isEditingTitle: boolean                                            │
│  editingTitleValue: string                                          │
│  isIngesting: boolean                                               │
│  ingestionProgress: number                                          │
│  runningHelper: string | null                                       │
│  pendingHelper: object | null                                       │
│  activeModal: string | null                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Page-Level State Machine

The main page has a hierarchical state machine with orthogonal regions.

### UI Mode State Machine

```
                                    ┌─────────┐
                                    │  INIT   │
                                    └────┬────┘
                                         │ [page loads]
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            ACTIVE                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         UI_MODE                                      │  │
│  │                                                                      │  │
│  │    ┌──────────────┐    startPreview    ┌──────────────┐             │  │
│  │    │   EDITING    │ ─────────────────► │   PREVIEW    │             │  │
│  │    │              │                    │              │             │  │
│  │    │ • Edit text  │ ◄───────────────── │ • View chunks│             │  │
│  │    │ • Delete item│   cancelPreview    │ • Ingest     │             │  │
│  │    │ • Run helpers│                    │ • Switch file│             │  │
│  │    └──────┬───────┘                    └──────┬───────┘             │  │
│  │           │                                   │                      │  │
│  │           │ selectIngestedFile               │ completeIngestion    │  │
│  │           │                                   │ completeBatchIngestion│  │
│  │           │         ┌──────────────┐          │                      │  │
│  │           └────────►│   READONLY   │◄─────────┘                      │  │
│  │                     │              │                                 │  │
│  │                     │ • View embed │                                 │  │
│  │                     │ • No editing │                                 │  │
│  │                     └──────────────┘                                 │  │
│  │                            │                                         │  │
│  │                            │ selectUploadedFile                      │  │
│  │                            │                                         │  │
│  │                            └──────────────────► back to EDITING      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modal State Machine (Orthogonal Region)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           MODAL_STATE                                       │
│                                                                            │
│  ┌──────────────┐                                                          │
│  │    CLOSED    │◄──────────────────────────────────────────┐              │
│  │              │                                           │              │
│  │ activeModal: │  openModal(type)                 closeModal              │
│  │   null       │──────────────┬──────────────────┬─────────┤              │
│  └──────────────┘              │                  │         │              │
│                                ▼                  ▼         │              │
│                    ┌──────────────┐    ┌──────────────┐     │              │
│                    │  INGESTION   │    │    REGEX     │     │              │
│                    │    MODAL     │    │    MODAL     │     │              │
│                    │              │    │              │     │              │
│                    │ onShowPreview│    │ onConfirm    │─────┤              │
│                    └──────┬───────┘    └──────────────┘     │              │
│                           │                                 │              │
│                           │                  ┌──────────────┤              │
│                           ▼                  │              │              │
│                    ┌──────────────┐    ┌─────┴────────┐     │              │
│                    │    CACHE     │    │ HELPER_FILE  │     │              │
│                    │  MANAGEMENT  │    │   SELECT     │─────┘              │
│                    │              │    │              │                    │
│                    │ onCacheCleared    │ onConfirm    │                    │
│                    └──────────────┘    └──────────────┘                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Select State Machine (Orthogonal Region)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        MULTI_SELECT_STATE                                   │
│                                                                            │
│  ┌──────────────┐   toggleMultiSelect   ┌──────────────┐                   │
│  │   DISABLED   │ ────────────────────► │   ENABLED    │                   │
│  │              │                       │              │                   │
│  │ multiSelect: │ ◄──────────────────── │ multiSelect: │                   │
│  │   false      │   toggleMultiSelect   │   true       │                   │
│  │              │   completeBatch       │              │                   │
│  │ checkedDocs: │   Ingestion           │ checkedDocs: │                   │
│  │   Set()      │                       │   Set(...)   │                   │
│  └──────────────┘                       └──────┬───────┘                   │
│                                                │                            │
│                                    ┌───────────┼───────────┐               │
│                                    │           │           │               │
│                                    ▼           ▼           ▼               │
│                            checkDocument  uncheckDoc  clearChecked         │
│                            (add to Set)  (remove)    (empty Set)           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Component State Machines

### ConnectedUploadZone State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      ConnectedUploadZone                                    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        UPLOAD_STATE                                   │  │
│  │                                                                       │  │
│  │    ┌──────────────┐                                                   │  │
│  │    │    IDLE      │◄─────────────────────────────────┐               │  │
│  │    │              │                                  │               │  │
│  │    │ isDragging:  │  dragEnter                      complete/fail    │  │
│  │    │   false      │───────────┐                      │               │  │
│  │    └──────────────┘           │                      │               │  │
│  │           │                   ▼                      │               │  │
│  │           │          ┌──────────────┐                │               │  │
│  │           │          │   DRAGGING   │                │               │  │
│  │           │          │              │                │               │  │
│  │           │          │ isDragging:  │                │               │  │
│  │           │          │   true       │                │               │  │
│  │           │          └──────┬───────┘                │               │  │
│  │           │                 │                        │               │  │
│  │           │    dragLeave    │    drop                │               │  │
│  │           │◄────────────────┤                        │               │  │
│  │           │                 ▼                        │               │  │
│  │           │          ┌──────────────┐                │               │  │
│  │           └──────────│  PROCESSING  │────────────────┘               │  │
│  │              error   │              │                                │  │
│  │                      │ For each file│                                │  │
│  │                      │ validate →   │                                │  │
│  │                      │ upload       │                                │  │
│  │                      └──────────────┘                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### File Upload Status State Machine (Per File)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    FILE_STATUS (per uploadQueue item)                       │
│                                                                            │
│    ┌──────────────┐                                                        │
│    │   QUEUED     │                                                        │
│    │              │                                                        │
│    │ status:      │  startUpload                                           │
│    │ 'queued'     │──────────────┐                                         │
│    └──────────────┘              │                                         │
│                                  ▼                                         │
│                         ┌──────────────┐                                   │
│                         │  UPLOADING   │                                   │
│                         │              │                                   │
│                         │ status:      │  uploadProgress                   │
│                         │ 'uploading'  │◄──────────────┐                   │
│                         │ progress: N% │───────────────┘                   │
│                         └──────┬───────┘                                   │
│                                │                                           │
│               uploadComplete   │    uploadFailed                           │
│              ┌─────────────────┼─────────────────┐                         │
│              │                                   │                         │
│              ▼                                   ▼                         │
│    ┌──────────────┐                    ┌──────────────┐                    │
│    │  PROCESSING  │                    │    ERROR     │                    │
│    │              │                    │              │                    │
│    │ status:      │  (backend done)    │ status:      │                    │
│    │ 'processing' │──────────┐         │ 'error'      │                    │
│    └──────────────┘          │         │ error: msg   │                    │
│                              ▼         └──────────────┘                    │
│                    ┌──────────────┐                                        │
│                    │    READY     │                                        │
│                    │              │                                        │
│                    │ status:      │                                        │
│                    │ 'ready'      │  selectFile → loads content            │
│                    └──────────────┘                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

### ConnectedFileQueue State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       ConnectedFileQueue                                    │
│                                                                            │
│  Global State Subscriptions:                                               │
│  • uploadQueue, ingestedFiles, selectedDocumentId (FileQueue)              │
│  • isPreviewMode, previewDocumentIds, previewConfig (Preview)              │
│  • multiSelectMode, checkedDocumentIds (UI)                                │
│                                                                            │
│  Local State:                                                              │
│  • switchingToDocId: string | null                                         │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    SELECTION_STATE                                    │  │
│  │                                                                       │  │
│  │    ┌─────────────────────────────────────────────────────────────┐   │  │
│  │    │                    NORMAL_MODE                               │   │  │
│  │    │                    (isPreviewMode: false)                    │   │  │
│  │    │                                                              │   │  │
│  │    │  ┌──────────────┐   click file   ┌──────────────┐           │   │  │
│  │    │  │   NO FILE    │ ─────────────► │FILE SELECTED │           │   │  │
│  │    │  │   SELECTED   │                │              │           │   │  │
│  │    │  │              │ ◄───────────── │ selectedId:  │           │   │  │
│  │    │  │ selectedId:  │   remove file  │   <docId>    │           │   │  │
│  │    │  │   null       │                │              │           │   │  │
│  │    │  └──────────────┘                └──────────────┘           │   │  │
│  │    └─────────────────────────────────────────────────────────────┘   │  │
│  │                           │                                          │  │
│  │                           │ startPreview                             │  │
│  │                           ▼                                          │  │
│  │    ┌─────────────────────────────────────────────────────────────┐   │  │
│  │    │                   PREVIEW_MODE                               │   │  │
│  │    │                   (isPreviewMode: true)                      │   │  │
│  │    │                                                              │   │  │
│  │    │  Shows only previewDocumentIds files                         │   │  │
│  │    │                                                              │   │  │
│  │    │  ┌──────────────┐  click diff   ┌──────────────┐            │   │  │
│  │    │  │   VIEWING    │   file        │  SWITCHING   │            │   │  │
│  │    │  │   PREVIEW    │ ────────────► │   PREVIEW    │            │   │  │
│  │    │  │              │               │              │            │   │  │
│  │    │  │ switchingTo: │ ◄──────────── │ switchingTo: │            │   │  │
│  │    │  │   null       │   API done    │   <docId>    │            │   │  │
│  │    │  └──────────────┘               │ (loading)    │            │   │  │
│  │    │                                 └──────────────┘            │   │  │
│  │    └─────────────────────────────────────────────────────────────┘   │  │
│  │                           │                                          │  │
│  │                           │ cancelPreview / completeIngestion        │  │
│  │                           ▼                                          │  │
│  │                    Back to NORMAL_MODE                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### ConnectedContentViewer State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     ConnectedContentViewer                                  │
│                                                                            │
│  Global State Subscriptions:                                               │
│  • documentState, currentPage, contentType, storedEmbeddings (Document)    │
│  • mode (UI)                                                               │
│                                                                            │
│  Props (from parent):                                                      │
│  • commandState, executeCommand, undo, redo, canUndo, canRedo              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      CONTENT_STATE                                    │  │
│  │                                                                       │  │
│  │    ┌──────────────┐                                                   │  │
│  │    │  NO_DOCUMENT │  documentLoaded                                   │  │
│  │    │              │ ─────────────────────────────────┐               │  │
│  │    │ documentState│                                  │               │  │
│  │    │   null       │ ◄────────────────────────────────┼───┐           │  │
│  │    └──────────────┘   documentReset / clearAllFiles  │   │           │  │
│  │                                                      │   │           │  │
│  │                                                      ▼   │           │  │
│  │    ┌─────────────────────────────────────────────────────┴───────┐   │  │
│  │    │                    HAS_DOCUMENT                              │   │  │
│  │    │                                                              │   │  │
│  │    │  ┌─────────────────────────────────────────────────────┐    │   │  │
│  │    │  │                  CONTENT_TYPE                        │    │   │  │
│  │    │  │                                                      │    │   │  │
│  │    │  │   ┌──────────────┐         ┌──────────────┐         │    │   │  │
│  │    │  │   │   EDITOR     │ select  │  EMBEDDING   │         │    │   │  │
│  │    │  │   │              │ ingested│              │         │    │   │  │
│  │    │  │   │ contentType: │ file    │ contentType: │         │    │   │  │
│  │    │  │   │  'editor'    │───────►│ 'embedding'  │         │    │   │  │
│  │    │  │   │              │         │              │         │    │   │  │
│  │    │  │   │ Editable:    │ select  │ Read-only:   │         │    │   │  │
│  │    │  │   │ • TextItem   │ uploaded│ • Shows      │         │    │   │  │
│  │    │  │   │ • ImageItem  │ file    │   stored     │         │    │   │  │
│  │    │  │   │ • TableItem  │◄────────│   embeddings │         │    │   │  │
│  │    │  │   └──────────────┘         └──────────────┘         │    │   │  │
│  │    │  └─────────────────────────────────────────────────────┘    │   │  │
│  │    │                                                              │   │  │
│  │    │  ┌─────────────────────────────────────────────────────┐    │   │  │
│  │    │  │              EDITING_ITEM (orthogonal)               │    │   │  │
│  │    │  │                                                      │    │   │  │
│  │    │  │   ┌──────────────┐  click   ┌──────────────┐        │    │   │  │
│  │    │  │   │  NOT_EDITING │  item    │   EDITING    │        │    │   │  │
│  │    │  │   │              │ ───────► │              │        │    │   │  │
│  │    │  │   │              │          │ • Textarea   │        │    │   │  │
│  │    │  │   │              │ ◄─────── │ • Save/Cancel│        │    │   │  │
│  │    │  │   │              │ Esc/Save │              │        │    │   │  │
│  │    │  │   └──────────────┘          └──────────────┘        │    │   │  │
│  │    │  └─────────────────────────────────────────────────────┘    │   │  │
│  │    └─────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### ConnectedHelperPanel State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      ConnectedHelperPanel                                   │
│                                                                            │
│  Global State Subscriptions:                                               │
│  • documentState (Document)                                                │
│  • runningHelper, pendingHelper (UI)                                       │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       HELPER_STATE                                    │  │
│  │                                                                       │  │
│  │    ┌──────────────┐                                                   │  │
│  │    │    IDLE      │                                                   │  │
│  │    │              │  click helper                                     │  │
│  │    │ runningHelper│──────────────────────────────────┐               │  │
│  │    │   null       │                                  │               │  │
│  │    └──────┬───────┘                                  │               │  │
│  │           │                                          │               │  │
│  │           │                                          ▼               │  │
│  │           │                                 ┌────────────────┐       │  │
│  │           │                                 │ CHECK_HELPER   │       │  │
│  │           │                                 │    TYPE        │       │  │
│  │           │                                 └────────┬───────┘       │  │
│  │           │                                          │               │  │
│  │           │           ┌──────────────────────────────┼───────────────┤  │
│  │           │           │                              │               │  │
│  │           │           ▼                              ▼               │  │
│  │           │  ┌──────────────┐             ┌──────────────┐           │  │
│  │           │  │LOCAL_HELPER  │             │BACKEND_HELPER│           │  │
│  │           │  │              │             │              │           │  │
│  │           │  │ remove_logos │             │ ai_image_desc│           │  │
│  │           │  │ remove_empty │             │              │           │  │
│  │           │  │ delete_regex │             │ pendingHelper│           │  │
│  │           │  │              │             │   set        │           │  │
│  │           │  └──────┬───────┘             └──────┬───────┘           │  │
│  │           │         │                            │                   │  │
│  │           │         │                            │ opens             │  │
│  │           │         │                            │ HELPER_FILE_SELECT│  │
│  │           │         │                            │ modal             │  │
│  │           │         │                            ▼                   │  │
│  │           │         │                   ┌──────────────┐             │  │
│  │           │         │                   │AWAITING_FILES│             │  │
│  │           │         │                   │              │             │  │
│  │           │         │                   │ User selects │             │  │
│  │           │         │                   │ files        │             │  │
│  │           │         │                   └──────┬───────┘             │  │
│  │           │         │                          │                     │  │
│  │           │         │ execute               onConfirm                │  │
│  │           │         │ immediately              │                     │  │
│  │           │         │                          ▼                     │  │
│  │           │         │                 ┌──────────────┐               │  │
│  │           │         └───────────────► │   RUNNING    │               │  │
│  │           │                           │              │               │  │
│  │           │                           │ runningHelper│               │  │
│  │           │                           │   <helperId> │               │  │
│  │           │                           │              │               │  │
│  │           │ ◄─────────────────────────│ API call     │               │  │
│  │           │   helperCompleted         │ in progress  │               │  │
│  │           │   helperFailed            └──────────────┘               │  │
│  │           │                                                          │  │
│  └───────────┴──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Preview & Ingestion State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PREVIEW_INGESTION_STATE                                  │
│                                                                            │
│    ┌──────────────┐                                                        │
│    │   NO_PREVIEW │                                                        │
│    │              │  openIngestionModal                                    │
│    │ isPreviewMode│─────────────────────────────────────────────┐          │
│    │   false      │                                             │          │
│    └──────────────┘                                             ▼          │
│           ▲                                         ┌──────────────┐       │
│           │                                         │ MODAL_OPEN   │       │
│           │                                         │              │       │
│           │  cancelPreview                          │ Select DB &  │       │
│           │  closeModal                             │ strategy     │       │
│           │◄────────────────────────────────────────┴──────┬───────┘       │
│           │                                                │               │
│           │                                      showPreview               │
│           │                                                │               │
│           │                                                ▼               │
│           │                                      ┌──────────────┐          │
│           │                                      │LOADING_PREVIEW│         │
│           │                                      │              │          │
│           │  previewFailed                       │ isLoadingPrev│          │
│           │◄─────────────────────────────────────│   true       │          │
│           │                                      │              │          │
│           │                                      │ API call...  │          │
│           │                                      └──────┬───────┘          │
│           │                                             │                  │
│           │                                    previewGenerated            │
│           │                                             │                  │
│           │                                             ▼                  │
│           │                                      ┌──────────────┐          │
│           │                                      │  PREVIEWING  │◄──────┐  │
│           │                                      │              │       │  │
│           │  cancelPreview                       │ isPreviewMode│       │  │
│           │◄─────────────────────────────────────│   true       │       │  │
│           │                                      │              │       │  │
│           │                                      │ Can switch   │       │  │
│           │                                      │ files        │───────┘  │
│           │                                      │switchPreview │          │
│           │                                      └──────┬───────┘          │
│           │                                             │                  │
│           │                        confirmIngestion / confirmIngestionAll  │
│           │                                             │                  │
│           │                                             ▼                  │
│           │                                      ┌──────────────┐          │
│           │                                      │  INGESTING   │          │
│           │                                      │              │          │
│           │  ingestionFailed                     │ isIngesting: │          │
│           │◄─────────────────────────────────────│   true       │          │
│           │                                      │              │          │
│           │                                      │ progress: N% │          │
│           │                                      └──────┬───────┘          │
│           │                                             │                  │
│           │                          completeIngestion / completeBatchIngest│
│           │                                             │                  │
│           │                                             ▼                  │
│           │                                      ┌──────────────┐          │
│           └──────────────────────────────────────│  COMPLETED   │          │
│                     (mode→READONLY)              │              │          │
│                                                  │ Added to     │          │
│                                                  │ ingestedFiles│          │
│                                                  └──────────────┘          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-Component Transitions

### File Selection Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      FILE_SELECTION_FLOW                                    │
│                                                                            │
│  ConnectedFileQueue                IngestionPage              ContentViewer │
│        │                                │                           │      │
│   click file                            │                           │      │
│        │                                │                           │      │
│        ▼                                │                           │      │
│  ┌──────────────┐                       │                           │      │
│  │actions.select│                       │                           │      │
│  │   File()     │──────────────────────►│                           │      │
│  └──────────────┘                       │                           │      │
│                                         ▼                           │      │
│                              ┌──────────────────┐                   │      │
│                              │ reducer handles  │                   │      │
│                              │ FILE_SELECTED    │                   │      │
│                              └────────┬─────────┘                   │      │
│                                       │                             │      │
│                                       │ useEffect detects           │      │
│                                       │ selectedDocumentId change   │      │
│                                       │                             │      │
│                                       ▼                             │      │
│                              ┌──────────────────┐                   │      │
│                              │ loadDocument()   │                   │      │
│                              │ • getFileContent │                   │      │
│                              │ • restoreHistory │                   │      │
│                              └────────┬─────────┘                   │      │
│                                       │                             │      │
│                                       │ actions.loadDocument()      │      │
│                                       │                             │      │
│                                       ▼                             ▼      │
│                              ┌──────────────────┐           ┌──────────┐   │
│                              │ DOCUMENT_LOADED  │──────────►│ re-render│   │
│                              │ updates document │           │ with new │   │
│                              │ domain           │           │ content  │   │
│                              └──────────────────┘           └──────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Ingestion Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         INGESTION_FLOW                                      │
│                                                                            │
│  IngestionPage         Reducer           FileQueue        EmbeddingViewer  │
│       │                   │                  │                   │         │
│  click "Ingest"           │                  │                   │         │
│       │                   │                  │                   │         │
│       ▼                   │                  │                   │         │
│  openModal()              │                  │                   │         │
│       │                   │                  │                   │         │
│       │  MODAL_OPENED     │                  │                   │         │
│       │─────────────────►│                  │                   │         │
│       │                   │                  │                   │         │
│  (modal: select DB, strategy)                │                   │         │
│       │                   │                  │                   │         │
│  click "Preview"          │                  │                   │         │
│       │                   │                  │                   │         │
│       ▼                   │                  │                   │         │
│  handleShowPreview()      │                  │                   │         │
│       │                   │                  │                   │         │
│       │ PREVIEW_STARTED   │                  │                   │         │
│       │─────────────────►│                  │                   │         │
│       │                   │  UI updated      │                   │         │
│       │                   │───────────────►│                   │         │
│       │                   │                  │  shows only      │         │
│       │                   │                  │  preview files   │         │
│       │                   │                  │                   │         │
│  API: previewEmbeddings() │                  │                   │         │
│       │                   │                  │                   │         │
│       │ PREVIEW_GENERATED │                  │                   │         │
│       │─────────────────►│                  │                   │         │
│       │                   │                  │                   ▼         │
│       │                   │                  │           ┌──────────────┐  │
│       │                   │                  │           │ shows preview│  │
│       │                   │                  │           │ + buttons    │  │
│       │                   │                  │           └──────────────┘  │
│       │                   │                  │                   │         │
│  click "Confirm"          │                  │                   │         │
│       │                   │                  │                   │         │
│       │ INGESTION_STARTED │                  │                   │         │
│       │─────────────────►│                  │                   │         │
│       │                   │                  │                   │         │
│  API: startIngestion()    │                  │                   │         │
│       │                   │                  │                   │         │
│       │ INGESTION_COMPLETE│                  │                   │         │
│       │─────────────────►│                  │                   │         │
│       │                   │                  │                   │         │
│       │                   │  ingestedFiles   │                   │         │
│       │                   │  updated         │                   │         │
│       │                   │───────────────►│                   │         │
│       │                   │                  │  shows ingested  │         │
│       │                   │                  │  section         │         │
│       │                   │                  │                   │         │
│       │                   │  preview domain  │                   │         │
│       │                   │  reset           │                   │         │
│       │                   │───────────────────────────────────►│         │
│       │                   │                  │                  hidden    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## State Transition Matrix

### UI Mode Transitions

| Current State | Event | Next State | Actions |
|---------------|-------|------------|---------|
| EDITING | `PREVIEW_STARTED` | PREVIEW | rightSidebar saved, collapsed, mode='preview' |
| EDITING | `FILE_SELECTED` (ingested) | READONLY | contentType='embedding', load storedEmbeddings |
| PREVIEW | `PREVIEW_CANCELLED` | EDITING | restore rightSidebar, mode='editing' |
| PREVIEW | `INGESTION_COMPLETE` | READONLY | add to ingestedFiles, mode='readonly' |
| PREVIEW | `INGESTION_BATCH_COMPLETE` | READONLY | add all to ingestedFiles, mode='readonly' |
| PREVIEW | `PREVIEW_FAILED` | EDITING | show error toast, restore rightSidebar |
| READONLY | `FILE_SELECTED` (uploaded) | EDITING | contentType='editor', load document |

### File Status Transitions

| Current Status | Event | Next Status | Side Effects |
|----------------|-------|-------------|--------------|
| - | `FILE_UPLOAD_STARTED` | QUEUED | add to uploadQueue |
| QUEUED | `FILE_UPLOAD_PROGRESS` | UPLOADING | update progress |
| UPLOADING | `FILE_UPLOAD_PROGRESS` | UPLOADING | update progress % |
| UPLOADING | `FILE_UPLOAD_COMPLETE` | PROCESSING | set documentId |
| UPLOADING | `FILE_UPLOAD_FAILED` | ERROR | set error message |
| PROCESSING | (backend done) | READY | ready for selection |

### Multi-Select Transitions

| Current State | Event | Next State | Side Effects |
|---------------|-------|------------|--------------|
| disabled | `MULTI_SELECT_TOGGLED` | enabled | show checkboxes |
| enabled | `MULTI_SELECT_TOGGLED` | disabled | clear checkedDocumentIds |
| enabled | `DOCUMENT_CHECKED` | enabled | toggle in checkedDocumentIds |
| enabled | `INGESTION_BATCH_COMPLETE` | disabled | clear all, exit preview |

### Modal Transitions

| Current Modal | Event | Next Modal | Side Effects |
|---------------|-------|------------|--------------|
| null | `MODAL_OPENED('ingestion')` | INGESTION | - |
| null | `MODAL_OPENED('regex')` | REGEX | - |
| null | `MODAL_OPENED('cache')` | CACHE_MANAGEMENT | - |
| null | `MODAL_OPENED('helper_file')` | HELPER_FILE_SELECT | - |
| any | `MODAL_CLOSED` | null | - |
| INGESTION | `PREVIEW_STARTED` | null | auto-close |

---

## Key Invariants

1. **Single Document Selection**: Only one `selectedDocumentId` at a time
2. **Preview Mode Exclusivity**: In preview mode, only `previewDocumentIds` files shown
3. **Ingesting Blocks UI**: When `isIngesting=true`, disable edits and navigation
4. **Modal Exclusivity**: Only one modal open at a time (`activeModal`)
5. **Content Type Match**: `contentType` must match file type (uploaded→editor, ingested→embedding)
6. **Multi-Select Clear on Batch**: `checkedDocumentIds` cleared after batch ingestion
