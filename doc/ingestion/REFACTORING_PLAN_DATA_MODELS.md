# Ingestion Page - Data Model Refactoring Plan

> **Author**: GitHub Copilot  
> **Created**: 2026-01-30  
> **Status**: PROPOSED

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals](#2-goals)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Data Models](#4-data-models)
5. [API Contract Models](#5-api-contract-models)
6. [Refactored Reducer Pattern](#6-refactored-reducer-pattern)
7. [Migration Strategy](#7-migration-strategy)
8. [Advantages](#8-advantages)
9. [File Structure](#9-file-structure)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Problem Statement

### Current Issues

1. **Opaque State Structure**: Each context is a plain object (dict). Reading the reducer, it's unclear:
   - What fields exist in each domain
   - What types each field should have
   - What the valid values are (e.g., is `status` a string? which strings?)

   **Example - `ingestedFiles` in reducer:**
   ```javascript
   // ingestionReducer.js - Initial state
   fileQueue: {
       uploadQueue: [],           // [{ id, documentId, filename, status, progress, error }]
       ingestedFiles: [],         // [{ ingestedId, documentId, filename, strategy, timestamp }]
       selectedDocumentId: null,
   },
   ```
   
   The comment says `[{ ingestedId, documentId, filename, strategy, timestamp }]` but:
   - Is `ingestedId` always present? 
   - Is `documentId` always present?
   - What about `id`? Some code uses `doc.id`
   - What about `embeddingPreview`? It's added in some actions
   
   **Result - Defensive code in components:**
   ```javascript
   // ConnectedFileQueue.jsx - Has to guess at field names
   {ingestedFiles.map((doc) => (
       <FileQueueItem
           key={doc.ingestedId || doc.id || doc.documentId}  // ❌ Which one is it?!
           doc={{
               ...doc,
               id: doc.ingestedId || doc.id || doc.documentId,      // ❌ Triple fallback
               documentId: doc.ingestedId || doc.documentId,        // ❌ Double fallback
               status: 'ingested'                                    // ❌ Hardcoded
           }}
           isSelected={(doc.ingestedId || doc.documentId) === selectedDocumentId}
           onSelect={() => handleSelect(doc.ingestedId || doc.documentId)}
           onRemoveFromSelection={() => handleRemoveIngestedFile(doc.ingestedId || doc.documentId)}
       />
   ))}
   ```
   
   **Why this happens:**
   - No enforced schema for `ingestedFiles` items
   - Different reducer actions add different fields
   - Component authors don't know which fields are guaranteed
   - Results in defensive `||` chains that hide bugs

2. **Inconsistent Item Shapes Across Actions**: The same array gets different shapes from different actions:
   ```javascript
   // INGESTION_COMPLETE adds this shape:
   ingestedEntry = {
       ingestedId: '...',
       documentId: '...',
       filename: '...',
       strategy: '...',
       timestamp: Date.now(),
       // But also sometimes:
       embeddingPreview: {...},  // Added in INGESTION_BATCH_COMPLETE
   }
   
   // INGESTED_FILES_LOADED might load from cache with different shape:
   ingestedFiles = [...] // Whatever was serialized - no validation!
   ```

3. **High Coupling**: The reducer directly manipulates state objects:
   ```javascript
   // Current: Reducer knows internal structure of fileQueue
   return {
       ...state,
       fileQueue: {
           ...state.fileQueue,
           uploadQueue: state.fileQueue.uploadQueue.map(f =>
               f.id === id ? { ...f, status: DOC_STATUS.READY } : f
           ),
       },
   };
   ```

3. **No Type Safety**: Plain objects offer no compile-time or runtime validation:
   - Typos in field names go unnoticed
   - Wrong types assigned silently
   - Missing required fields not caught

4. **API Contracts Undocumented**: Request/response shapes are implicit in code, making it hard to:
   - Understand what backend expects
   - Validate responses
   - Maintain consistency

5. **Business Logic Scattered**: Validation and transformation logic lives in:
   - Reducer (state transitions)
   - Components (event handlers)
   - Services (API calls)

6. **Component-State Coupling**: Components directly access internal state structure:
   ```javascript
   // ConnectedContentViewer.jsx - Components know too much about state shape
   const totalPages = doc?.pages?.length || 0;           // Knows pages is array
   const currentPageContent = doc?.pages?.[currentPage - 1];  // Knows array indexing
   
   const handlePageChange = useCallback((page) => {
       if (!doc?.pages) return;
       const maxPage = doc.pages.length;                  // Duplicated logic
       const newPage = Math.max(1, Math.min(page, maxPage)); // Business logic in component
       actions.changePage(newPage);
   }, [doc, actions]);
   
   // Finding item requires knowing nested structure
   for (const page of doc.pages) {
       const item = page.items.find(i => i.id === itemId);
       if (item) { oldContent = item.content; break; }
   }
   ```
   
   **Problems:**
   - If state structure changes (e.g., `pages` becomes a Map), ALL components break
   - Business logic (page clamping) duplicated across components
   - Null-checking (`?.`) repeated everywhere
   - Components are tightly coupled to internal state shape

---

## 2. Goals

1. **Encapsulated Data Models**: Each context domain has a class with:
   - Typed properties (documented, self-explanatory)
   - Getter methods (computed properties, safe access)
   - Setter methods (validation, immutable updates)
   - Factory methods (create from API, create empty)

2. **Reducer as Coordinator**: Reducer calls model setters instead of direct manipulation:
   ```javascript
   // Target: Reducer delegates to model
   case ActionTypes.FILE_UPLOAD_COMPLETE:
       return {
           ...state,
           fileQueue: state.fileQueue.completeUpload(id, documentId),
       };
   ```

3. **API Contract Models**: Request/response shapes as classes with:
   - Validation
   - Serialization/deserialization
   - Documentation via JSDoc

4. **Backward Compatibility**: External API (hooks, actions) remains unchanged:
   - `useFileQueue()` returns same shape
   - `actions.completeFileUpload()` works identically
   - Only internal implementation changes

5. **Discoverable State Lifecycle**: With models, you can understand:
   - What fields exist (class definition)
   - What fields are required vs optional (constructor validation)
   - How state changes (setter methods)
   - Where state comes from (factory methods like `fromJSON()`, `fromAPI()`)

---

## 3. Proposed Architecture

### 3.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Components                                      │
│  (use hooks: useFileQueue, useDocument, usePreview, useUI)                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Read state via getters
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Model Classes                                 │
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐│
│  │ FileQueueModel  │ │ DocumentModel   │ │ PreviewModel    │ │ UIModel    ││
│  │                 │ │                 │ │                 │ │            ││
│  │ - uploadQueue   │ │ - documentState │ │ - isPreviewMode │ │ - mode     ││
│  │ - ingestedFiles │ │ - currentPage   │ │ - embeddingPrev │ │ - modals   ││
│  │ - selectedDocId │ │ - contentType   │ │ - previewConfig │ │ - sidebars ││
│  │                 │ │ - embeddings    │ │ - documentIds   │ │ - helpers  ││
│  │ + getters       │ │ + getters       │ │ + getters       │ │ + getters  ││
│  │ + setters       │ │ + setters       │ │ + setters       │ │ + setters  ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └────────────┘│
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Reducer calls setters
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ingestionReducer.js                                  │
│                                                                             │
│  switch (action.type) {                                                    │
│    case FILE_UPLOAD_COMPLETE:                                              │
│      return {                                                              │
│        ...state,                                                           │
│        fileQueue: state.fileQueue.completeUpload(id, documentId),          │
│      };                                                                    │
│  }                                                                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ API calls use contract models
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API Contract Models                                    │
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌─────────────────────────┐ │
│  │ UploadRequest      │ │ UploadResponse     │ │ IngestRequest           │ │
│  │ - file: File       │ │ - success: boolean │ │ - targetDb: string      │ │
│  │ - config?: Object  │ │ - filename: string │ │ - documentState: Object │ │
│  │                    │ │ - content: DocState│ │ - strategy: string      │ │
│  │ + validate()       │ │ + fromJSON()       │ │                         │ │
│  │ + toFormData()     │ │ + toDocumentModel()│ │ + validate()            │ │
│  └────────────────────┘ └────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 State Lifecycle Example: `ingestedFiles`

**The Problem:** Looking at `ingestedFiles: []` tells you nothing about how items are added/modified.

**Current Code Analysis** - You have to read the ENTIRE reducer to understand:

```javascript
// 1. INGESTION_COMPLETE - Adds single item
case ActionTypes.INGESTION_COMPLETE: {
    const { ingestedEntry, ingestedData } = action.payload;
    // ingestedEntry shape: { ingestedId, documentId, filename, strategy, timestamp }
    // But wait, sometimes also has embeddingPreview? Who knows!
    
    let updatedIngestedFiles = state.fileQueue.ingestedFiles;
    if (ingestedEntry) {
        const existingIndex = updatedIngestedFiles.findIndex(...);
        // ... 15 lines of array manipulation
    }
}

// 2. INGESTION_BATCH_COMPLETE - Adds multiple items
case ActionTypes.INGESTION_BATCH_COMPLETE: {
    const { ingestedEntries } = action.payload;
    // ingestedEntries shape: array of... what exactly?
    // Has embeddingPreview? Maybe?
    
    for (const entry of ingestedEntries) {
        // ... more array manipulation
    }
}

// 3. INGESTED_FILES_LOADED - Replaces entire array (from cache)
case ActionTypes.INGESTED_FILES_LOADED: {
    const { ingestedFiles } = action.payload;
    // What shape? Whatever was serialized!
}

// 4. INGESTED_FILE_REMOVED - Removes item
case ActionTypes.INGESTED_FILE_REMOVED: {
    // Uses ingestedId to filter
}

// 5. CACHE_CLEARED - Clears array
case ActionTypes.CACHE_CLEARED: {
    // Sets to []
}
```

**With Data Models** - Lifecycle is documented in one place:

```javascript
// frontend/src/context/ingestion/models/FileQueueModel.js

class IngestedFileItem {
    // FIELDS ARE DOCUMENTED HERE
    constructor({ ingestedId, documentId, filename, strategy, targetDb, timestamp, embeddingCount, embeddingPreview }) {
        // Required fields validated
        if (!ingestedId) throw new Error('ingestedId required');
        // ... 
    }
    
    // CANONICAL IDENTIFIER
    get id() { return this.ingestedId; }
}

class FileQueueModel {
    // HOW ITEMS ARE ADDED - documented via setter methods
    
    /**
     * Add or update an ingested file entry.
     * Called by: INGESTION_COMPLETE, INGESTION_BATCH_COMPLETE
     */
    addIngestedFile(entry) {
        const item = new IngestedFileItem(entry); // Validates shape!
        // ... immutable update
    }
    
    /**
     * Add multiple ingested file entries.
     * Called by: INGESTION_BATCH_COMPLETE
     */
    addIngestedFiles(entries) {
        let result = this;
        for (const entry of entries) {
            result = result.addIngestedFile(entry);
        }
        return result;
    }
    
    /**
     * Load ingested files from cache.
     * Called by: INGESTED_FILES_LOADED
     * Note: Validates each item via IngestedFileItem constructor
     */
    loadFromCache(ingestedFiles) {
        return new FileQueueModel({
            ...this,
            ingestedFiles: ingestedFiles.map(f => new IngestedFileItem(f)),
        });
    }
    
    /**
     * Remove an ingested file.
     * Called by: INGESTED_FILE_REMOVED
     */
    removeIngestedFile(ingestedId) { ... }
    
    /**
     * Clear all ingested files.
     * Called by: CACHE_CLEARED
     */
    clearIngested() { ... }
}
```

**Benefits:**
- Open `FileQueueModel.js` → see ALL operations on `ingestedFiles`
- Each method documents when it's called
- Constructor validates shape → no more "which field exists?" guessing
- Components use `item.id` → no more `item.ingestedId || item.id || item.documentId`

---

## 4. Data Models

### 4.1 FileQueueModel

```javascript
// frontend/src/context/ingestion/models/FileQueueModel.js

import { DOC_STATUS } from '../constants';

/**
 * Represents a file in the upload queue
 */
export class UploadQueueItem {
    /**
     * @param {Object} data
     * @param {string} data.id - Unique upload ID (UUID)
     * @param {string} data.documentId - Document ID after processing (null if pending)
     * @param {string} data.filename - Original filename
     * @param {string} data.status - One of DOC_STATUS values
     * @param {number} data.progress - Upload progress 0-100
     * @param {string} [data.error] - Error message if failed
     */
    constructor({ id, documentId = null, filename, status, progress = 0, error = null }) {
        this.id = id;
        this.documentId = documentId;
        this.filename = filename;
        this.status = status;
        this.progress = progress;
        this.error = error;
        Object.freeze(this); // Immutable
    }

    // ============ GETTERS ============

    get isReady() {
        return this.status === DOC_STATUS.READY;
    }

    get isUploading() {
        return this.status === DOC_STATUS.UPLOADING;
    }

    get isQueued() {
        return this.status === DOC_STATUS.QUEUED;
    }

    get hasError() {
        return this.status === DOC_STATUS.ERROR;
    }

    get displayName() {
        return this.filename.replace(/\.[^/.]+$/, ''); // Remove extension
    }

    // ============ SETTERS (return new instance) ============

    withProgress(status, progress) {
        return new UploadQueueItem({
            ...this,
            status,
            progress,
        });
    }

    withComplete(documentId) {
        return new UploadQueueItem({
            ...this,
            documentId,
            status: DOC_STATUS.READY,
            progress: 100,
        });
    }

    withError(error) {
        return new UploadQueueItem({
            ...this,
            status: DOC_STATUS.ERROR,
            error,
        });
    }

    withFilename(newFilename) {
        return new UploadQueueItem({
            ...this,
            filename: newFilename,
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            id: this.id,
            documentId: this.documentId,
            filename: this.filename,
            status: this.status,
            progress: this.progress,
            error: this.error,
        };
    }

    static fromJSON(json) {
        return new UploadQueueItem(json);
    }
}

/**
 * Represents an ingested file
 * 
 * SOLVES: The "which field do I use?" problem
 * 
 * Before (component code):
 *   key={doc.ingestedId || doc.id || doc.documentId}  // Guessing!
 *   documentId: doc.ingestedId || doc.documentId      // More guessing!
 * 
 * After (with this model):
 *   key={doc.id}           // Always use .id
 *   documentId: doc.id     // .id is the canonical identifier
 */
export class IngestedFileItem {
    /**
     * @param {Object} data
     * @param {string} data.ingestedId - Unique ingested ID (REQUIRED)
     * @param {string} data.documentId - Original document ID before ingestion
     * @param {string} data.filename - Filename (REQUIRED)
     * @param {string} data.strategy - Ingestion strategy used
     * @param {string} data.targetDb - Target database
     * @param {number} data.timestamp - Ingestion timestamp
     * @param {number} [data.embeddingCount] - Number of embeddings created
     * @param {Object} [data.embeddingPreview] - Preview data (optional, for display)
     */
    constructor({ 
        ingestedId, 
        documentId, 
        filename, 
        strategy, 
        targetDb, 
        timestamp, 
        embeddingCount = 0,
        embeddingPreview = null,
    }) {
        // Validate required fields
        if (!ingestedId) {
            throw new Error('IngestedFileItem requires ingestedId');
        }
        if (!filename) {
            throw new Error('IngestedFileItem requires filename');
        }

        this.ingestedId = ingestedId;
        this.documentId = documentId || ingestedId; // Fallback for compatibility
        this.filename = filename;
        this.strategy = strategy || 'unknown';
        this.targetDb = targetDb || 'unknown';
        this.timestamp = timestamp || Date.now();
        this.embeddingCount = embeddingCount;
        this.embeddingPreview = embeddingPreview;
        Object.freeze(this);
    }

    // ============ CANONICAL IDENTIFIERS ============
    // Components should ALWAYS use these, never raw field access

    /**
     * The canonical unique identifier for this item.
     * Use this for React keys and selection comparisons.
     */
    get id() {
        return this.ingestedId;
    }

    /**
     * The status is always 'ingested' for IngestedFileItem
     */
    get status() {
        return 'ingested';
    }

    // ============ DISPLAY GETTERS ============

    get displayName() {
        return this.filename.replace(/\.[^/.]+$/, '');
    }

    get formattedDate() {
        return new Date(this.timestamp).toLocaleDateString();
    }

    get formattedDateTime() {
        return new Date(this.timestamp).toLocaleString();
    }

    // ============ COMPONENT HELPER ============
    
    /**
     * Returns props ready for FileQueueItem component.
     * Eliminates the need for inline object transformation.
     * 
     * Before (in component):
     *   doc={{
     *       ...doc,
     *       id: doc.ingestedId || doc.id || doc.documentId,
     *       documentId: doc.ingestedId || doc.documentId,
     *       status: 'ingested'
     *   }}
     * 
     * After:
     *   doc={doc.toFileQueueItemProps()}
     */
    toFileQueueItemProps() {
        return {
            id: this.id,
            documentId: this.id,
            filename: this.filename,
            status: this.status,
            strategy: this.strategy,
            targetDb: this.targetDb,
            timestamp: this.timestamp,
            embeddingCount: this.embeddingCount,
        };
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            ingestedId: this.ingestedId,
            documentId: this.documentId,
            filename: this.filename,
            strategy: this.strategy,
            targetDb: this.targetDb,
            timestamp: this.timestamp,
            embeddingCount: this.embeddingCount,
            embeddingPreview: this.embeddingPreview,
        };
    }

    static fromJSON(json) {
        return new IngestedFileItem(json);
    }
}

/**
 * FileQueue Domain Model
 * Manages upload queue and ingested files
 */
export class FileQueueModel {
    /**
     * @param {Object} data
     * @param {UploadQueueItem[]} data.uploadQueue
     * @param {IngestedFileItem[]} data.ingestedFiles
     * @param {string|null} data.selectedDocumentId
     */
    constructor({
        uploadQueue = [],
        ingestedFiles = [],
        selectedDocumentId = null,
    }) {
        this.uploadQueue = uploadQueue.map(item =>
            item instanceof UploadQueueItem ? item : new UploadQueueItem(item)
        );
        this.ingestedFiles = ingestedFiles.map(item =>
            item instanceof IngestedFileItem ? item : new IngestedFileItem(item)
        );
        this.selectedDocumentId = selectedDocumentId;
        Object.freeze(this);
    }

    // ============ GETTERS ============

    get readyFiles() {
        return this.uploadQueue.filter(f => f.isReady);
    }

    get uploadingFiles() {
        return this.uploadQueue.filter(f => f.isUploading || f.isQueued);
    }

    get hasSelectedFile() {
        return this.selectedDocumentId !== null;
    }

    get selectedFile() {
        return this.uploadQueue.find(f => f.documentId === this.selectedDocumentId)
            || this.ingestedFiles.find(f => f.ingestedId === this.selectedDocumentId);
    }

    get isEmpty() {
        return this.uploadQueue.length === 0 && this.ingestedFiles.length === 0;
    }

    getFileByDocumentId(documentId) {
        return this.uploadQueue.find(f => f.documentId === documentId);
    }

    getFileByUploadId(uploadId) {
        return this.uploadQueue.find(f => f.id === uploadId);
    }

    // ============ SETTERS (return new FileQueueModel) ============

    addUpload(id, file, filename) {
        const newItem = new UploadQueueItem({
            id,
            filename,
            status: DOC_STATUS.QUEUED,
            progress: 0,
        });
        return new FileQueueModel({
            ...this,
            uploadQueue: [...this.uploadQueue, newItem],
        });
    }

    updateUploadProgress(id, status, progress) {
        return new FileQueueModel({
            ...this,
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withProgress(status, progress) : f
            ),
        });
    }

    completeUpload(id, documentId) {
        return new FileQueueModel({
            ...this,
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withComplete(documentId) : f
            ),
        });
    }

    failUpload(id, error) {
        return new FileQueueModel({
            ...this,
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withError(error) : f
            ),
        });
    }

    selectFile(documentId) {
        return new FileQueueModel({
            ...this,
            selectedDocumentId: documentId,
        });
    }

    removeFile(documentId) {
        const isSelected = this.selectedDocumentId === documentId;
        return new FileQueueModel({
            ...this,
            uploadQueue: this.uploadQueue.filter(f => f.documentId !== documentId),
            selectedDocumentId: isSelected ? null : this.selectedDocumentId,
        });
    }

    renameFile(documentId, newFilename) {
        return new FileQueueModel({
            ...this,
            uploadQueue: this.uploadQueue.map(f =>
                f.documentId === documentId ? f.withFilename(newFilename) : f
            ),
        });
    }

    addIngestedFile(entry) {
        const item = entry instanceof IngestedFileItem
            ? entry
            : new IngestedFileItem(entry);

        // Check for existing (update) or new (add)
        const existingIndex = this.ingestedFiles.findIndex(
            f => f.ingestedId === item.ingestedId
        );

        let newIngestedFiles;
        if (existingIndex >= 0) {
            newIngestedFiles = [
                ...this.ingestedFiles.slice(0, existingIndex),
                item,
                ...this.ingestedFiles.slice(existingIndex + 1),
            ];
        } else {
            newIngestedFiles = [...this.ingestedFiles, item];
        }

        return new FileQueueModel({
            ...this,
            ingestedFiles: newIngestedFiles,
        });
    }

    removeIngestedFile(ingestedId) {
        const isSelected = this.selectedDocumentId === ingestedId;
        return new FileQueueModel({
            ...this,
            ingestedFiles: this.ingestedFiles.filter(f => f.ingestedId !== ingestedId),
            selectedDocumentId: isSelected ? null : this.selectedDocumentId,
        });
    }

    restoreFromCache(uploadQueue, ingestedFiles = undefined) {
        return new FileQueueModel({
            ...this,
            uploadQueue: uploadQueue.map(item => new UploadQueueItem(item)),
            ...(ingestedFiles !== undefined && {
                ingestedFiles: ingestedFiles.map(item => new IngestedFileItem(item)),
            }),
        });
    }

    clearUploaded() {
        return new FileQueueModel({
            ...this,
            uploadQueue: [],
            selectedDocumentId: null,
        });
    }

    clearIngested() {
        return new FileQueueModel({
            ...this,
            ingestedFiles: [],
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            uploadQueue: this.uploadQueue.map(f => f.toJSON()),
            ingestedFiles: this.ingestedFiles.map(f => f.toJSON()),
            selectedDocumentId: this.selectedDocumentId,
        };
    }

    static fromJSON(json) {
        return new FileQueueModel(json);
    }

    static empty() {
        return new FileQueueModel({});
    }
}
```

### 4.2 DocumentModel

```javascript
// frontend/src/context/ingestion/models/DocumentModel.js

import { CONTENT_TYPE } from '../constants';

/**
 * Document Item (text, image, table)
 */
export class DocumentItem {
    constructor({ id, type, content, classification, imageUrl, deleted = false, ...rest }) {
        this.id = id;
        this.type = type; // 'text' | 'image' | 'picture' | 'table'
        this.content = content;
        this.classification = classification; // For images
        this.imageUrl = imageUrl; // For images
        this.deleted = deleted;
        // Preserve any additional fields
        Object.assign(this, rest);
        Object.freeze(this);
    }

    get isText() {
        return this.type === 'text';
    }

    get isImage() {
        return this.type === 'image' || this.type === 'picture';
    }

    get isTable() {
        return this.type === 'table';
    }

    get isDeleted() {
        return this.deleted === true;
    }

    get isEmpty() {
        return this.isText && (!this.content || this.content.trim().length <= 1);
    }

    withContent(newContent) {
        return new DocumentItem({ ...this, content: newContent });
    }

    withClassification(newClassification) {
        return new DocumentItem({ ...this, classification: newClassification });
    }

    withDeleted(deleted) {
        return new DocumentItem({ ...this, deleted });
    }

    toJSON() {
        const json = { ...this };
        // Remove undefined values
        Object.keys(json).forEach(key => json[key] === undefined && delete json[key]);
        return json;
    }

    static fromJSON(json) {
        return new DocumentItem(json);
    }
}

/**
 * Document Page
 */
export class DocumentPage {
    constructor({ pageNumber, items = [] }) {
        this.pageNumber = pageNumber;
        this.items = items.map(item =>
            item instanceof DocumentItem ? item : new DocumentItem(item)
        );
        Object.freeze(this);
    }

    get activeItems() {
        return this.items.filter(item => !item.isDeleted);
    }

    get textItems() {
        return this.items.filter(item => item.isText && !item.isDeleted);
    }

    get imageItems() {
        return this.items.filter(item => item.isImage && !item.isDeleted);
    }

    getItemById(itemId) {
        return this.items.find(item => item.id === itemId);
    }

    withItem(itemId, updater) {
        return new DocumentPage({
            ...this,
            items: this.items.map(item =>
                item.id === itemId ? updater(item) : item
            ),
        });
    }

    withItems(items) {
        return new DocumentPage({
            ...this,
            items,
        });
    }

    toJSON() {
        return {
            pageNumber: this.pageNumber,
            items: this.items.map(item => item.toJSON()),
        };
    }

    static fromJSON(json) {
        return new DocumentPage(json);
    }
}

/**
 * Document State (full document)
 */
export class DocumentState {
    constructor({ filename, documentId, pages = [] }) {
        this.filename = filename;
        this.documentId = documentId;
        this.pages = pages.map(page =>
            page instanceof DocumentPage ? page : new DocumentPage(page)
        );
        Object.freeze(this);
    }

    // ============ PAGE NAVIGATION GETTERS ============

    get totalPages() {
        return this.pages.length;
    }

    get maxPage() {
        return this.pages.length;
    }

    get isEmpty() {
        return this.pages.length === 0;
    }

    /**
     * Get page by 1-indexed page number
     * @param {number} pageNumber - 1-indexed page number
     * @returns {DocumentPage|null}
     */
    getPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.maxPage) return null;
        return this.pages[pageNumber - 1] || null;
    }

    /**
     * Clamp page number to valid range [1, maxPage]
     * Used by components to ensure valid page navigation
     * @param {number} page - Requested page number
     * @returns {number} - Valid page number
     */
    clampPage(page) {
        if (this.isEmpty) return 1;
        return Math.max(1, Math.min(page, this.maxPage));
    }

    /**
     * Check if page number is valid
     * @param {number} page - Page number to check
     * @returns {boolean}
     */
    isValidPage(page) {
        return page >= 1 && page <= this.maxPage;
    }

    // ============ ITEM GETTERS ============

    get totalItems() {
        return this.pages.reduce((sum, page) => sum + page.items.length, 0);
    }

    get allItems() {
        return this.pages.flatMap(page => page.items);
    }

    get allActiveItems() {
        return this.pages.flatMap(page => page.activeItems);
    }

    get allImages() {
        return this.pages.flatMap(page => page.imageItems);
    }

    getItemById(itemId) {
        for (const page of this.pages) {
            const item = page.getItemById(itemId);
            if (item) return item;
        }
        return null;
    }

    // ============ SETTERS (return new instance) ============

    withPage(pageNumber, updater) {
        return new DocumentState({
            ...this,
            pages: this.pages.map(page =>
                page.pageNumber === pageNumber ? updater(page) : page
            ),
        });
    }

    withItem(itemId, updater) {
        return new DocumentState({
            ...this,
            pages: this.pages.map(page => {
                const item = page.getItemById(itemId);
                if (item) {
                    return page.withItem(itemId, updater);
                }
                return page;
            }),
        });
    }

    toJSON() {
        return {
            filename: this.filename,
            documentId: this.documentId,
            pages: this.pages.map(page => page.toJSON()),
        };
    }

    static fromJSON(json) {
        if (!json) return null;
        return new DocumentState(json);
    }
}

/**
 * Document Domain Model
 */
export class DocumentModel {
    constructor({
        documentState = null,
        currentPage = 1,
        contentType = CONTENT_TYPE.EDITOR,
        storedEmbeddings = null,
    }) {
        this.documentState = documentState instanceof DocumentState
            ? documentState
            : DocumentState.fromJSON(documentState);
        this.currentPage = currentPage;
        this.contentType = contentType;
        this.storedEmbeddings = storedEmbeddings;
        Object.freeze(this);
    }

    // ============ GETTERS ============

    get hasDocument() {
        return this.documentState !== null;
    }

    get isEditorMode() {
        return this.contentType === CONTENT_TYPE.EDITOR;
    }

    get isEmbeddingMode() {
        return this.contentType === CONTENT_TYPE.EMBEDDING;
    }

    get currentPageData() {
        return this.documentState?.getPage(this.currentPage);
    }

    get totalPages() {
        return this.documentState?.totalPages || 0;
    }

    get canGoNext() {
        return this.currentPage < this.totalPages;
    }

    get canGoPrevious() {
        return this.currentPage > 1;
    }

    // ============ SETTERS ============

    loadDocument(documentState, documentId) {
        return new DocumentModel({
            ...this,
            documentState: DocumentState.fromJSON(documentState),
            currentPage: 1,
            contentType: CONTENT_TYPE.EDITOR,
            storedEmbeddings: null,
        });
    }

    modifyDocument(documentState) {
        return new DocumentModel({
            ...this,
            documentState: documentState instanceof DocumentState
                ? documentState
                : DocumentState.fromJSON(documentState),
        });
    }

    resetDocument() {
        return new DocumentModel({
            ...this,
            documentState: null,
            currentPage: 1,
        });
    }

    changePage(page) {
        return new DocumentModel({
            ...this,
            currentPage: page,
        });
    }

    setContentType(contentType) {
        return new DocumentModel({
            ...this,
            contentType,
        });
    }

    setStoredEmbeddings(embeddings) {
        return new DocumentModel({
            ...this,
            storedEmbeddings: embeddings,
            contentType: CONTENT_TYPE.EMBEDDING,
            documentState: null,
            currentPage: 1,
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            documentState: this.documentState?.toJSON() || null,
            currentPage: this.currentPage,
            contentType: this.contentType,
            storedEmbeddings: this.storedEmbeddings,
        };
    }

    static fromJSON(json) {
        return new DocumentModel(json);
    }

    static empty() {
        return new DocumentModel({});
    }
}
```

### 4.3 PreviewModel

```javascript
// frontend/src/context/ingestion/models/PreviewModel.js

/**
 * Preview Configuration
 */
export class PreviewConfig {
    constructor({ targetDb = '', strategy = '' }) {
        this.targetDb = targetDb;
        this.strategy = strategy;
        Object.freeze(this);
    }

    get isValid() {
        return this.targetDb.length > 0 && this.strategy.length > 0;
    }

    toJSON() {
        return { targetDb: this.targetDb, strategy: this.strategy };
    }

    static fromJSON(json) {
        return new PreviewConfig(json);
    }

    static empty() {
        return new PreviewConfig({});
    }
}

/**
 * Preview Domain Model
 */
export class PreviewModel {
    constructor({
        isPreviewMode = false,
        isLoadingPreview = false,
        embeddingPreview = null,
        previewConfig = {},
        previewDocumentIds = new Set(),
    }) {
        this.isPreviewMode = isPreviewMode;
        this.isLoadingPreview = isLoadingPreview;
        this.embeddingPreview = embeddingPreview;
        this.previewConfig = previewConfig instanceof PreviewConfig
            ? previewConfig
            : new PreviewConfig(previewConfig);
        this.previewDocumentIds = previewDocumentIds instanceof Set
            ? previewDocumentIds
            : new Set(previewDocumentIds);
        Object.freeze(this);
    }

    // ============ GETTERS ============

    get isActive() {
        return this.isPreviewMode;
    }

    get isLoading() {
        return this.isLoadingPreview;
    }

    get hasPreview() {
        return this.embeddingPreview !== null;
    }

    get isMultiFile() {
        return this.previewDocumentIds.size > 1;
    }

    get documentCount() {
        return this.previewDocumentIds.size;
    }

    hasDocument(documentId) {
        return this.previewDocumentIds.has(documentId);
    }

    // ============ SETTERS ============

    startPreview(targetDb, strategy, documentIds) {
        return new PreviewModel({
            ...this,
            isPreviewMode: true,
            isLoadingPreview: true,
            previewConfig: new PreviewConfig({ targetDb, strategy }),
            previewDocumentIds: new Set(documentIds),
        });
    }

    setPreviewGenerated(embeddingPreview) {
        return new PreviewModel({
            ...this,
            isLoadingPreview: false,
            embeddingPreview,
        });
    }

    setPreviewLoading(isLoading) {
        return new PreviewModel({
            ...this,
            isLoadingPreview: isLoading,
        });
    }

    removeDocument(documentId) {
        const newIds = new Set(this.previewDocumentIds);
        newIds.delete(documentId);
        
        // If no documents left, reset
        if (newIds.size === 0) {
            return PreviewModel.empty();
        }

        return new PreviewModel({
            ...this,
            previewDocumentIds: newIds,
        });
    }

    cancel() {
        return PreviewModel.empty();
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            isPreviewMode: this.isPreviewMode,
            isLoadingPreview: this.isLoadingPreview,
            embeddingPreview: this.embeddingPreview,
            previewConfig: this.previewConfig.toJSON(),
            previewDocumentIds: Array.from(this.previewDocumentIds),
        };
    }

    static fromJSON(json) {
        return new PreviewModel({
            ...json,
            previewDocumentIds: new Set(json.previewDocumentIds || []),
        });
    }

    static empty() {
        return new PreviewModel({});
    }
}
```

### 4.4 UIModel

```javascript
// frontend/src/context/ingestion/models/UIModel.js

import { UI_MODE, MODAL_TYPES } from '../constants';

/**
 * UI Domain Model
 */
export class UIModel {
    constructor({
        mode = UI_MODE.EDITING,
        leftSidebarCollapsed = false,
        rightSidebarCollapsed = false,
        rightSidebarStateBeforePreview = false,
        isDragging = false,
        multiSelectMode = false,
        checkedDocumentIds = new Set(),
        isEditingTitle = false,
        editingTitleValue = '',
        isIngesting = false,
        ingestionProgress = 0,
        runningHelper = null,
        pendingHelper = null,
        activeModal = null,
    }) {
        this.mode = mode;
        this.leftSidebarCollapsed = leftSidebarCollapsed;
        this.rightSidebarCollapsed = rightSidebarCollapsed;
        this.rightSidebarStateBeforePreview = rightSidebarStateBeforePreview;
        this.isDragging = isDragging;
        this.multiSelectMode = multiSelectMode;
        this.checkedDocumentIds = checkedDocumentIds instanceof Set
            ? checkedDocumentIds
            : new Set(checkedDocumentIds);
        this.isEditingTitle = isEditingTitle;
        this.editingTitleValue = editingTitleValue;
        this.isIngesting = isIngesting;
        this.ingestionProgress = ingestionProgress;
        this.runningHelper = runningHelper;
        this.pendingHelper = pendingHelper;
        this.activeModal = activeModal;
        Object.freeze(this);
    }

    // ============ GETTERS ============

    get isEditingMode() {
        return this.mode === UI_MODE.EDITING;
    }

    get isPreviewMode() {
        return this.mode === UI_MODE.PREVIEW;
    }

    get isReadonlyMode() {
        return this.mode === UI_MODE.READONLY;
    }

    get hasActiveModal() {
        return this.activeModal !== null;
    }

    get isHelperRunning() {
        return this.runningHelper !== null;
    }

    get hasPendingHelper() {
        return this.pendingHelper !== null;
    }

    get checkedCount() {
        return this.checkedDocumentIds.size;
    }

    isDocumentChecked(documentId) {
        return this.checkedDocumentIds.has(documentId);
    }

    isModalOpen(modalType) {
        return this.activeModal === modalType;
    }

    // ============ SETTERS ============

    setMode(mode) {
        return new UIModel({ ...this, mode });
    }

    toggleLeftSidebar() {
        return new UIModel({
            ...this,
            leftSidebarCollapsed: !this.leftSidebarCollapsed,
        });
    }

    toggleRightSidebar() {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: !this.rightSidebarCollapsed,
        });
    }

    setRightSidebarCollapsed(collapsed) {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: collapsed,
        });
    }

    saveRightSidebarState() {
        return new UIModel({
            ...this,
            rightSidebarStateBeforePreview: this.rightSidebarCollapsed,
        });
    }

    restoreRightSidebarState() {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: this.rightSidebarStateBeforePreview,
        });
    }

    setDragging(isDragging) {
        return new UIModel({ ...this, isDragging });
    }

    toggleMultiSelect() {
        const newMode = !this.multiSelectMode;
        return new UIModel({
            ...this,
            multiSelectMode: newMode,
            checkedDocumentIds: newMode ? this.checkedDocumentIds : new Set(),
        });
    }

    toggleDocumentChecked(documentId) {
        const newChecked = new Set(this.checkedDocumentIds);
        if (newChecked.has(documentId)) {
            newChecked.delete(documentId);
        } else {
            newChecked.add(documentId);
        }
        return new UIModel({
            ...this,
            checkedDocumentIds: newChecked,
        });
    }

    clearCheckedDocuments() {
        return new UIModel({
            ...this,
            checkedDocumentIds: new Set(),
        });
    }

    startTitleEditing(value) {
        return new UIModel({
            ...this,
            isEditingTitle: true,
            editingTitleValue: value,
        });
    }

    endTitleEditing() {
        return new UIModel({
            ...this,
            isEditingTitle: false,
            editingTitleValue: '',
        });
    }

    startIngestion() {
        return new UIModel({
            ...this,
            isIngesting: true,
            ingestionProgress: 0,
        });
    }

    setIngestionProgress(progress) {
        return new UIModel({
            ...this,
            ingestionProgress: progress,
        });
    }

    completeIngestion() {
        return new UIModel({
            ...this,
            isIngesting: false,
            ingestionProgress: 0,
        });
    }

    startHelper(helperId) {
        return new UIModel({
            ...this,
            runningHelper: helperId,
        });
    }

    completeHelper() {
        return new UIModel({
            ...this,
            runningHelper: null,
        });
    }

    setPendingHelper(helper) {
        return new UIModel({
            ...this,
            pendingHelper: helper,
        });
    }

    clearPendingHelper() {
        return new UIModel({
            ...this,
            pendingHelper: null,
        });
    }

    openModal(modalType) {
        return new UIModel({
            ...this,
            activeModal: modalType,
        });
    }

    closeModal() {
        return new UIModel({
            ...this,
            activeModal: null,
        });
    }

    // Compound operations
    enterPreviewMode(rightSidebarState) {
        return new UIModel({
            ...this,
            mode: UI_MODE.PREVIEW,
            rightSidebarStateBeforePreview: rightSidebarState,
            rightSidebarCollapsed: false, // Expand for preview
        });
    }

    exitPreviewMode() {
        return new UIModel({
            ...this,
            mode: UI_MODE.EDITING,
            rightSidebarCollapsed: this.rightSidebarStateBeforePreview,
        });
    }

    enterReadonlyMode() {
        return new UIModel({
            ...this,
            mode: UI_MODE.READONLY,
            isIngesting: false,
            ingestionProgress: 0,
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            mode: this.mode,
            leftSidebarCollapsed: this.leftSidebarCollapsed,
            rightSidebarCollapsed: this.rightSidebarCollapsed,
            rightSidebarStateBeforePreview: this.rightSidebarStateBeforePreview,
            isDragging: this.isDragging,
            multiSelectMode: this.multiSelectMode,
            checkedDocumentIds: Array.from(this.checkedDocumentIds),
            isEditingTitle: this.isEditingTitle,
            editingTitleValue: this.editingTitleValue,
            isIngesting: this.isIngesting,
            ingestionProgress: this.ingestionProgress,
            runningHelper: this.runningHelper,
            pendingHelper: this.pendingHelper,
            activeModal: this.activeModal,
        };
    }

    static fromJSON(json) {
        return new UIModel({
            ...json,
            checkedDocumentIds: new Set(json.checkedDocumentIds || []),
        });
    }

    static empty() {
        return new UIModel({});
    }
}
```

---

## 5. API Contract Models

```javascript
// frontend/src/services/models/ingestionContracts.js

/**
 * Upload Request
 */
export class UploadRequest {
    constructor({ file, config = {} }) {
        this.file = file;
        this.config = config;
    }

    validate() {
        if (!this.file) {
            throw new Error('File is required');
        }
        if (!(this.file instanceof File)) {
            throw new Error('file must be a File object');
        }
        const validTypes = ['application/pdf'];
        if (!validTypes.includes(this.file.type)) {
            throw new Error(`Invalid file type: ${this.file.type}`);
        }
        return true;
    }

    toFormData() {
        const formData = new FormData();
        formData.append('file', this.file);
        if (Object.keys(this.config).length > 0) {
            formData.append('config', JSON.stringify(this.config));
        }
        return formData;
    }
}

/**
 * Upload Response
 */
export class UploadResponse {
    constructor({ success, filename, content, error }) {
        this.success = success;
        this.filename = filename;
        this.content = content; // DocumentState-compatible object
        this.error = error;
        Object.freeze(this);
    }

    get isSuccess() {
        return this.success === true;
    }

    get hasContent() {
        return this.content !== null && this.content !== undefined;
    }

    toDocumentState() {
        if (!this.hasContent) return null;
        // Import dynamically to avoid circular deps
        const { DocumentState } = require('../context/ingestion/models/DocumentModel');
        return DocumentState.fromJSON(this.content);
    }

    static fromJSON(json) {
        return new UploadResponse(json);
    }
}

/**
 * Preview Request
 */
export class PreviewRequest {
    constructor({ strategy, documentState }) {
        this.strategy = strategy;
        this.documentState = documentState;
    }

    validate() {
        if (!this.strategy) {
            throw new Error('strategy is required');
        }
        if (!this.documentState) {
            throw new Error('documentState is required');
        }
        return true;
    }

    toJSON() {
        return {
            strategy: this.strategy,
            documentState: this.documentState,
        };
    }
}

/**
 * Preview Response
 */
export class PreviewResponse {
    constructor({ success, embeddings = [], metadata = {}, error }) {
        this.success = success;
        this.embeddings = embeddings;
        this.metadata = metadata;
        this.error = error;
        Object.freeze(this);
    }

    get isSuccess() {
        return this.success === true;
    }

    get embeddingCount() {
        return this.embeddings.length;
    }

    static fromJSON(json) {
        return new PreviewResponse(json);
    }
}

/**
 * Ingest Request
 */
export class IngestRequest {
    constructor({ targetDb, documentState, strategy = 'embed_per_page' }) {
        this.targetDb = targetDb;
        this.documentState = documentState;
        this.strategy = strategy;
    }

    validate() {
        if (!this.targetDb) {
            throw new Error('targetDb is required');
        }
        if (!this.documentState) {
            throw new Error('documentState is required');
        }
        if (!this.strategy) {
            throw new Error('strategy is required');
        }
        return true;
    }

    toJSON() {
        return {
            targetDb: this.targetDb,
            documentState: this.documentState,
            strategy: this.strategy,
        };
    }
}

/**
 * Ingest Response
 */
export class IngestResponse {
    constructor({ success, ingestedId, embeddingCount, error }) {
        this.success = success;
        this.ingestedId = ingestedId;
        this.embeddingCount = embeddingCount;
        this.error = error;
        Object.freeze(this);
    }

    get isSuccess() {
        return this.success === true;
    }

    static fromJSON(json) {
        return new IngestResponse(json);
    }
}

/**
 * Image Description Request
 */
export class ImageDescriptionRequest {
    constructor({ documentId, images }) {
        this.documentId = documentId;
        this.images = images; // Array of { id, imageUrl, classification, pageNumber }
    }

    validate() {
        if (!this.documentId) {
            throw new Error('documentId is required');
        }
        if (!Array.isArray(this.images) || this.images.length === 0) {
            throw new Error('images array is required and must not be empty');
        }
        return true;
    }

    toJSON() {
        return {
            documentId: this.documentId,
            images: this.images,
        };
    }
}

/**
 * Image Description Response
 */
export class ImageDescriptionResponse {
    constructor({ success, descriptions = [], message, error }) {
        this.success = success;
        this.descriptions = descriptions; // Array of { imageId, description }
        this.message = message;
        this.error = error;
        Object.freeze(this);
    }

    get isSuccess() {
        return this.success === true;
    }

    get descriptionCount() {
        return this.descriptions.length;
    }

    static fromJSON(json) {
        return new ImageDescriptionResponse(json);
    }
}
```

---

## 6. Refactored Reducer Pattern

### Before (Current)

```javascript
case ActionTypes.FILE_UPLOAD_COMPLETE: {
    const { id, documentId } = action.payload;
    return {
        ...state,
        fileQueue: {
            ...state.fileQueue,
            uploadQueue: state.fileQueue.uploadQueue.map(f =>
                f.id === id
                    ? { ...f, documentId, status: DOC_STATUS.READY, progress: 100 }
                    : f
            ),
        },
    };
}
```

### After (Refactored)

```javascript
case ActionTypes.FILE_UPLOAD_COMPLETE: {
    const { id, documentId } = action.payload;
    return {
        ...state,
        fileQueue: state.fileQueue.completeUpload(id, documentId),
    };
}
```

### Full Reducer Example

```javascript
// frontend/src/context/ingestion/ingestionReducer.js (refactored)

import * as ActionTypes from './actionTypes';
import { FileQueueModel } from './models/FileQueueModel';
import { DocumentModel } from './models/DocumentModel';
import { PreviewModel } from './models/PreviewModel';
import { UIModel } from './models/UIModel';

export const initialState = {
    fileQueue: FileQueueModel.empty(),
    document: DocumentModel.empty(),
    preview: PreviewModel.empty(),
    ui: UIModel.empty(),
};

export function ingestionReducer(state, action) {
    switch (action.type) {
        // ============ FILE QUEUE ============

        case ActionTypes.FILE_UPLOAD_STARTED: {
            const { id, file, filename } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.addUpload(id, file, filename),
            };
        }

        case ActionTypes.FILE_UPLOAD_PROGRESS: {
            const { id, status, progress } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.updateUploadProgress(id, status, progress),
            };
        }

        case ActionTypes.FILE_UPLOAD_COMPLETE: {
            const { id, documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.completeUpload(id, documentId),
            };
        }

        case ActionTypes.FILE_SELECTED: {
            const { documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.selectFile(documentId),
            };
        }

        case ActionTypes.FILE_REMOVED: {
            const { documentId } = action.payload;
            const wasSelected = state.fileQueue.selectedDocumentId === documentId;
            return {
                ...state,
                fileQueue: state.fileQueue.removeFile(documentId),
                document: wasSelected
                    ? state.document.resetDocument()
                    : state.document,
            };
        }

        // ============ DOCUMENT ============

        case ActionTypes.DOCUMENT_LOADED: {
            const { documentState, documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.selectFile(documentId),
                document: state.document.loadDocument(documentState, documentId),
            };
        }

        case ActionTypes.DOCUMENT_MODIFIED: {
            const { documentState } = action.payload;
            return {
                ...state,
                document: state.document.modifyDocument(documentState),
            };
        }

        case ActionTypes.PAGE_CHANGED: {
            const { page } = action.payload;
            return {
                ...state,
                document: state.document.changePage(page),
            };
        }

        // ============ PREVIEW ============

        case ActionTypes.PREVIEW_STARTED: {
            const { targetDb, strategy, documentIds, rightSidebarState } = action.payload;
            return {
                ...state,
                preview: state.preview.startPreview(targetDb, strategy, documentIds),
                ui: state.ui.enterPreviewMode(rightSidebarState),
            };
        }

        case ActionTypes.PREVIEW_GENERATED: {
            const { embeddingPreview } = action.payload;
            return {
                ...state,
                preview: state.preview.setPreviewGenerated(embeddingPreview),
            };
        }

        case ActionTypes.PREVIEW_CANCELLED: {
            return {
                ...state,
                preview: state.preview.cancel(),
                ui: state.ui.exitPreviewMode(),
            };
        }

        // ============ UI ============

        case ActionTypes.LEFT_SIDEBAR_TOGGLED: {
            return {
                ...state,
                ui: state.ui.toggleLeftSidebar(),
            };
        }

        case ActionTypes.MODAL_OPENED: {
            const { modalType } = action.payload;
            return {
                ...state,
                ui: state.ui.openModal(modalType),
            };
        }

        case ActionTypes.MODAL_CLOSED: {
            return {
                ...state,
                ui: state.ui.closeModal(),
            };
        }

        case ActionTypes.HELPER_STARTED: {
            const { helperId } = action.payload;
            return {
                ...state,
                ui: state.ui.startHelper(helperId),
            };
        }

        case ActionTypes.HELPER_COMPLETED: {
            return {
                ...state,
                ui: state.ui.completeHelper(),
            };
        }

        // ============ CROSS-DOMAIN ACTIONS ============

        case ActionTypes.INGESTION_COMPLETE: {
            const { ingestedEntry, ingestedData, rightSidebarState } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue
                    .addIngestedFile(ingestedEntry)
                    .selectFile(ingestedEntry?.ingestedId),
                document: state.document.setStoredEmbeddings(ingestedData),
                preview: state.preview.cancel(),
                ui: state.ui
                    .enterReadonlyMode()
                    .setRightSidebarCollapsed(rightSidebarState),
            };
        }

        default:
            console.warn(`[ingestionReducer] Unknown action type: ${action.type}`);
            return state;
    }
}
```

---

## 7. Migration Strategy

### Phase 1: Create Models (Non-Breaking)

1. Create model files in `frontend/src/context/ingestion/models/`
2. Write unit tests for each model
3. Models exist alongside current code (not used yet)

### Phase 2: Migrate Reducer (One Domain at a Time)

1. Start with `UIModel` (simplest, no nested arrays)
2. Update `initialState.ui` to use `UIModel.empty()`
3. Update UI action cases to use model setters
4. Test thoroughly
5. Repeat for `PreviewModel`, `DocumentModel`, `FileQueueModel`

### Phase 3: Update Provider

1. Ensure contexts still provide correct shape
2. Models expose same properties as before (backward compatible)

### Phase 4: Migrate API Services

1. Create contract models
2. Update `ingestionApi.js` to use contracts
3. Add validation to API calls

### Phase 5: Update Components (Recommended)

Components should migrate from direct state access to using model getters.
This decouples components from internal state structure.

**Priority Order:**
1. `ConnectedContentViewer.jsx` - page navigation, item access
2. `ConnectedFileQueue.jsx` - file list, status checks
3. `ConnectedHelperPanel.jsx` - item queries for helpers
4. Other Connected components

**Migration Examples:**

```javascript
// ============ BEFORE ============
// ConnectedContentViewer.jsx

const totalPages = doc?.pages?.length || 0;
const currentPageContent = doc?.pages?.[currentPage - 1];

const handlePageChange = useCallback((page) => {
    if (!doc?.pages) return;
    const maxPage = doc.pages.length;
    const newPage = Math.max(1, Math.min(page, maxPage));
    actions.changePage(newPage);
}, [doc, actions]);

const handleEditItem = useCallback((itemId, newContent) => {
    if (!doc) return;
    let oldContent = '';
    for (const page of doc.pages) {
        const item = page.items.find(i => i.id === itemId);
        if (item) {
            oldContent = item.content;
            break;
        }
    }
    executeCommand(Commands.editItem(itemId, newContent, oldContent));
}, [doc, executeCommand]);


// ============ AFTER ============
// ConnectedContentViewer.jsx

const totalPages = doc?.totalPages || 0;
const currentPageContent = doc?.getPage(currentPage);

const handlePageChange = useCallback((page) => {
    if (!doc) return;
    actions.changePage(doc.clampPage(page));
}, [doc, actions]);

const handleEditItem = useCallback((itemId, newContent) => {
    if (!doc) return;
    const oldContent = doc.getItemById(itemId)?.content || '';
    executeCommand(Commands.editItem(itemId, newContent, oldContent));
}, [doc, executeCommand]);
```

```javascript
// ============ BEFORE ============
// ConnectedFileQueue.jsx

const readyFiles = uploadQueue.filter(f => f.status === DOC_STATUS.READY);
const hasUploading = uploadQueue.some(f => 
    f.status === DOC_STATUS.UPLOADING || f.status === DOC_STATUS.QUEUED
);


// ============ AFTER ============
// ConnectedFileQueue.jsx

const readyFiles = fileQueue.readyFiles;
const hasUploading = fileQueue.uploadingFiles.length > 0;
```

```javascript
// ============ BEFORE ============
// ConnectedFileQueue.jsx - Ingested files section
// Developer doesn't know which fields exist, uses defensive fallbacks

{ingestedFiles.map((doc) => (
    <FileQueueItem
        key={doc.ingestedId || doc.id || doc.documentId}      // ❌ Which one?!
        doc={{
            ...doc,
            id: doc.ingestedId || doc.id || doc.documentId,   // ❌ Triple fallback
            documentId: doc.ingestedId || doc.documentId,     // ❌ Double fallback  
            status: 'ingested'                                 // ❌ Hardcoded
        }}
        isSelected={(doc.ingestedId || doc.documentId) === selectedDocumentId}
        onSelect={() => handleSelect(doc.ingestedId || doc.documentId)}
        onRemoveFromSelection={() => handleRemoveIngestedFile(doc.ingestedId || doc.documentId)}
    />
))}


// ============ AFTER ============
// ConnectedFileQueue.jsx - With IngestedFileItem model
// Model guarantees fields exist, provides canonical .id getter

{ingestedFiles.map((doc) => (
    <FileQueueItem
        key={doc.id}                                          // ✅ Always use .id
        doc={doc.toFileQueueItemProps()}                      // ✅ Model handles shape
        isSelected={doc.id === selectedDocumentId}            // ✅ Simple comparison
        onSelect={() => handleSelect(doc.id)}                 // ✅ Just .id
        onRemoveFromSelection={() => handleRemoveIngestedFile(doc.id)}
    />
))}

// Or even simpler with a dedicated component prop:
{ingestedFiles.map((doc) => (
    <IngestedFileQueueItem
        key={doc.id}
        item={doc}                                            // ✅ Pass model directly
        isSelected={fileQueue.isSelected(doc.id)}             // ✅ Model method
        onSelect={handleSelect}
        onRemove={handleRemoveIngestedFile}
    />
))}
```

```javascript
// ============ BEFORE ============
// ConnectedHelperPanel.jsx (collecting images for AI helper)

const images = [];
for (const page of documentState.pages) {
    for (const item of page.items) {
        if ((item.type === 'image' || item.type === 'picture') && !item.deleted) {
            images.push({
                id: item.id,
                imageUrl: item.imageUrl,
                classification: item.classification,
                pageNumber: page.pageNumber,
            });
        }
    }
}


// ============ AFTER ============
// ConnectedHelperPanel.jsx

const images = documentState.allImages.map(item => ({
    id: item.id,
    imageUrl: item.imageUrl,
    classification: item.classification,
    pageNumber: documentState.getPageForItem(item.id)?.pageNumber,
}));
```

---

## 8. Advantages

### 8.1 Readability & Self-Documentation

**Before:**
```javascript
// What fields does uploadQueue item have? 🤷
state.fileQueue.uploadQueue
```

**After:**
```javascript
// Class definition is the documentation
class UploadQueueItem {
    /** @param {string} id - Unique upload ID (UUID) */
    /** @param {string} documentId - Document ID after processing */
    /** @param {string} filename - Original filename */
    /** @param {string} status - One of DOC_STATUS values */
    // ...
}
```

### 8.2 Encapsulated Logic

**Before:** Logic scattered across reducer AND components
```javascript
// In reducer:
if (file.status === DOC_STATUS.READY) { ... }

// In ConnectedContentViewer.jsx:
const maxPage = doc.pages.length;
const newPage = Math.max(1, Math.min(page, maxPage));
```

**After:** Logic in one place (model)
```javascript
// Getter encapsulates the check
if (file.isReady) { ... }

// In component - clean, declarative
const newPage = doc.clampPage(page);
// or
const maxPage = doc.maxPage;
```

### 8.3 Component Access Pattern Improvement

**Current Problem:** Components directly access internal state structure:

```javascript
// ConnectedContentViewer.jsx - PROBLEMATIC
const handlePageChange = useCallback((page) => {
    if (!doc?.pages) return;
    const maxPage = doc.pages.length;        // ❌ Accesses internal structure
    const newPage = Math.max(1, Math.min(page, maxPage));  // ❌ Business logic in component
    actions.changePage(newPage);
}, [doc, actions]);

// Also in the same file:
const totalPages = doc?.pages?.length || 0;  // ❌ Repeated pattern
const currentPageContent = doc?.pages?.[currentPage - 1];  // ❌ Direct array access
```

**After Refactoring:** Components use getter methods:

```javascript
// ConnectedContentViewer.jsx - CLEAN
const handlePageChange = useCallback((page) => {
    if (!doc) return;
    const newPage = doc.clampPage(page);     // ✅ Model handles bounds
    actions.changePage(newPage);
}, [doc, actions]);

// Clean property access:
const totalPages = doc?.totalPages || 0;     // ✅ Getter method
const currentPageContent = doc?.getPage(currentPage);  // ✅ Getter method
```

**DocumentState Model with Getters:**

```javascript
class DocumentState {
    // ... constructor ...

    // ============ GETTERS ============
    
    get totalPages() {
        return this.pages.length;
    }

    get maxPage() {
        return this.pages.length;
    }

    get isEmpty() {
        return this.pages.length === 0;
    }

    getPage(pageNumber) {
        // 1-indexed page number
        return this.pages[pageNumber - 1] || null;
    }

    /**
     * Clamp page number to valid range
     * @param {number} page - Requested page number
     * @returns {number} - Valid page number (1 to maxPage)
     */
    clampPage(page) {
        return Math.max(1, Math.min(page, this.maxPage));
    }

    isValidPage(page) {
        return page >= 1 && page <= this.maxPage;
    }
}
```

**Benefits of Getter Pattern:**

| Aspect | Before | After |
|--------|--------|-------|
| Structure coupling | Component knows `doc.pages` is array | Component only knows `doc.totalPages` |
| Null safety | `doc?.pages?.length \|\| 0` everywhere | `doc?.totalPages \|\| 0` (handled in getter) |
| Business logic | Scattered in components | Centralized in model |
| Refactoring | Change structure = change all components | Change structure = change only model |
| Testing | Test component + state structure | Test model independently |

### 8.4 Immutability Guaranteed

**Before:** Easy to accidentally mutate
```javascript
// Oops, mutated original array
state.fileQueue.uploadQueue.push(newItem);
```

**After:** `Object.freeze()` prevents mutation
```javascript
// TypeError: Cannot add property, object is not extensible
model.uploadQueue.push(newItem); // Throws!
```

### 8.4 Reduced Reducer Complexity

**Before:** 851 lines of spread operators
**After:** ~200 lines of model method calls

### 8.5 Type Safety (with JSDoc)

```javascript
/**
 * @param {string} id
 * @param {string} documentId
 * @returns {FileQueueModel}
 */
completeUpload(id, documentId) { ... }
```

IDE will show warnings for wrong types.

### 8.6 Easier Testing

**Before:** Test entire reducer
**After:** Test models in isolation

```javascript
describe('FileQueueModel', () => {
    it('completes upload correctly', () => {
        const model = FileQueueModel.empty()
            .addUpload('upload-1', file, 'test.pdf');
        
        const updated = model.completeUpload('upload-1', 'doc-123');
        
        expect(updated.getFileByUploadId('upload-1').isReady).toBe(true);
        expect(updated.getFileByUploadId('upload-1').documentId).toBe('doc-123');
    });
});
```

### 8.7 Computed Properties

**Before:** Compute in components
```javascript
const readyFiles = uploadQueue.filter(f => f.status === DOC_STATUS.READY);
```

**After:** Built into model
```javascript
const readyFiles = fileQueue.readyFiles; // Getter
```

### 8.8 Serialization Built-In

```javascript
// Save to localStorage
localStorage.setItem('fileQueue', JSON.stringify(fileQueue.toJSON()));

// Restore from localStorage
const restored = FileQueueModel.fromJSON(JSON.parse(stored));
```

### 8.9 API Contract Validation

```javascript
// Before calling API
const request = new IngestRequest({ targetDb, documentState, strategy });
request.validate(); // Throws if invalid

// After receiving response
const response = IngestResponse.fromJSON(data);
if (!response.isSuccess) {
    throw new Error(response.error);
}
```

---

## 9. File Structure

```
frontend/src/context/ingestion/
├── models/
│   ├── index.js                 # Re-export all models
│   ├── FileQueueModel.js        # FileQueue domain model
│   ├── DocumentModel.js         # Document domain model
│   ├── PreviewModel.js          # Preview domain model
│   └── UIModel.js               # UI domain model
├── IngestionProvider.jsx        # (unchanged API)
├── actionTypes.js               # (unchanged)
├── constants.js                 # (unchanged)
├── contexts.js                  # (unchanged)
├── hooks.js                     # (unchanged API)
├── index.js                     # (unchanged)
└── ingestionReducer.js          # Refactored to use models

frontend/src/services/
├── models/
│   └── ingestionContracts.js    # API request/response models
└── ingestionApi.js              # Updated to use contracts
```

---

## 10. Implementation Phases

| Phase | Scope | Effort | Risk |
|-------|-------|--------|------|
| 1. Create Model Classes | Add new files | 2-3 days | None (additive) |
| 2. Unit Tests for Models | Add tests | 1-2 days | None |
| 3. Migrate UIModel | Update reducer | 0.5 day | Low |
| 4. Migrate PreviewModel | Update reducer | 0.5 day | Low |
| 5. Migrate DocumentModel | Update reducer | 1 day | Medium |
| 6. Migrate FileQueueModel | Update reducer | 1 day | Medium |
| 7. API Contract Models | Add contracts | 1 day | None |
| 8. Update ingestionApi.js | Use contracts | 0.5 day | Low |
| 9. Update Components (optional) | Use getters | Ongoing | None |

**Total Estimated Effort: 7-10 days**

---

## Summary

This refactoring introduces **Data Model Classes** that:

1. **Document the shape** of each context domain via class properties
2. **Encapsulate business logic** in getter/setter methods
3. **Guarantee immutability** via `Object.freeze()`
4. **Reduce reducer complexity** from 851 lines to ~200 lines
5. **Enable isolated testing** of state transitions
6. **Provide type safety** via JSDoc annotations
7. **Include API contracts** for request/response validation

The external API (hooks, actions) remains **100% backward compatible**. Components continue to use `useFileQueue()`, `useDocument()`, etc. exactly as before. Only the internal implementation changes.
