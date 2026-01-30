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

## Identifiers Reference

| Identifier | Format | Purpose | Example |
|------------|--------|---------|---------|
| `uploadId` | UUID | Unique upload session ID | `"f47ac10b-58cc..."` |
| `documentId` | Server-assigned | Processed document ID | `"doc_abc123"` |
| `ingestedId` | `${documentId}_${strategy}` | Unique per document+strategy | `"doc_abc123_slides_qa"` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial behavior registry |
