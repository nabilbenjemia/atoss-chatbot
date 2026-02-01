# Ingestion Page - Manual Test Flows

> **Last Updated**: 2026-01-30
> 
> This document describes all user interaction flows on the Ingestion Page.
> Each flow includes:
> 1. **User Steps** - What the tester should do
> 2. **Expected Observations** - What the user should see
> 3. **Sequence Diagram** - What happens in the code

---

## Table of Contents

1. [Document Upload](#1-document-upload)
   - [1.1 Click to Upload](#11-click-to-upload)
   - [1.2 Drag and Drop Upload](#12-drag-and-drop-upload)
2. [File Selection](#2-file-selection)
3. [Page Navigation](#3-page-navigation)
4. [Item Operations](#4-item-operations)
   - [4.1 Edit Text Item](#41-edit-text-item)
   - [4.2 Delete Item](#42-delete-item)
   - [4.3 Restore Item](#43-restore-item)
   - [4.4 Change Image Classification](#44-change-image-classification)
5. [Undo/Redo](#5-undoredo)
6. [Helper Functions](#6-helper-functions)
   - [6.1 Remove Logos](#61-remove-logos)
   - [6.2 Remove Empty Text](#62-remove-empty-text)
   - [6.3 Delete by Regex](#63-delete-by-regex)
   - [6.4 AI Image Descriptions](#64-ai-image-descriptions)
   - [6.5 Multi-File Helper](#65-multi-file-helper)
7. [Preview & Ingestion](#7-preview--ingestion)
   - [7.1 Single File Ingestion](#71-single-file-ingestion)
   - [7.2 Multi-File Ingestion](#72-multi-file-ingestion)
8. [Sidebar Toggle](#8-sidebar-toggle)
9. [Cache Management](#9-cache-management)

---

## 1. Document Upload

### 1.1 Click to Upload

**User Steps:**
1. Navigate to the Ingestion Page (`/admin/ingestion`)
2. Click on the upload zone (dotted border area with "Drop files or click to upload")
3. In the file picker dialog, select one or more PDF files
4. Click "Open" to confirm

**Expected Observations:**
- File picker dialog opens
- After selection, a loading spinner appears on the upload zone
- Toast notification: "Document ready: {filename}"
- File appears in the File Queue (left sidebar) with "READY" status
- If first file uploaded, it auto-selects and content appears in the main viewer
- Content shows extracted text items, images, and tables

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│     User      │     │ ConnectedUploadZone│     │  ingestionApi   │     │ Ingestion Svc │     │  LLM Service │
└───────┬───────┘     └─────────┬──────────┘     └────────┬────────┘     └───────┬───────┘     └──────┬───────┘
        │                       │                         │                      │                    │
        │ 1. Click upload zone  │                         │                      │                    │
        │──────────────────────>│                         │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 2. Open file picker     │                      │                    │
        │                       │    (native dialog)      │                      │                    │
        │                       │                         │                      │                    │
        │ 3. Select file(s)     │                         │                      │                    │
        │──────────────────────>│                         │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 4. validateFiles()      │                      │                    │
        │                       │    - check file type    │                      │                    │
        │                       │    - check file size    │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 5. actions.startFileUpload(uploadId, file)     │                    │
        │                       │──────────────────────────────────────────────> │                    │
        │                       │                         │                      │                    │
        │                       │        REDUCER: FILE_UPLOAD_STARTED            │                    │
        │                       │        → uploadQueue.push({id, filename,       │                    │
        │                       │          status: 'uploading'})                 │                    │
        │                       │                         │                      │                    │
        │                       │ 6. POST /api/ingestion/upload                  │                    │
        │                       │─────────────────────────>│                     │                    │
        │                       │                         │                      │                    │
        │                       │                         │ 7. uploadForProcessing()                  │
        │                       │                         │─────────────────────>│                    │
        │                       │                         │                      │                    │
        │                       │                         │                      │ 8. [TODO] Process PDF
        │                       │                         │                      │───────────────────>│
        │                       │                         │                      │                    │
        │                       │                         │                      │ 9. [MOCK] Return   │
        │                       │                         │                      │    generateMockContent()
        │                       │                         │<─────────────────────│                    │
        │                       │                         │                      │                    │
        │                       │ 10. Return { success, content }                │                    │
        │                       │<─────────────────────────│                     │                    │
        │                       │                         │                      │                    │
        │                       │ 11. saveFileContent(documentId, content)       │                    │
        │                       │     (localStorage)      │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 12. actions.completeFileUpload(uploadId, documentId)               │
        │                       │──────────────────────────────────────────────> │                    │
        │                       │                         │                      │                    │
        │                       │        REDUCER: FILE_UPLOAD_COMPLETED          │                    │
        │                       │        → uploadQueue[id].status = 'ready'      │                    │
        │                       │        → uploadQueue[id].documentId = docId    │                    │
        │                       │                         │                      │                    │
        │                       │ 13. toast.success("Document ready: {filename}")│                    │
        │                       │                         │                      │                    │
        │                       │ 14. actions.selectFile(documentId) [if first]  │                    │
        │                       │──────────────────────────────────────────────> │                    │
        │                       │                         │                      │                    │
        │                       │        REDUCER: FILE_SELECTED                  │                    │
        │                       │        → selectedDocumentId = documentId       │                    │
        │                       │                         │                      │                    │
        │ 15. UI re-renders     │                         │                      │                    │
        │    - File in queue    │                         │                      │                    │
        │    - Content in viewer│                         │                      │                    │
        │<──────────────────────│                         │                      │                    │
        │                       │                         │                      │                    │
```

---

### 1.2 Drag and Drop Upload

**User Steps:**
1. Navigate to the Ingestion Page
2. Drag a PDF file from your file system
3. Hover over the upload zone (it should highlight blue)
4. Drop the file

**Expected Observations:**
- While dragging over, upload zone border turns blue with "Drop files here" text
- After drop, same flow as click upload
- Toast: "Document ready: {filename}"
- File appears in queue and content displays

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌─────────────────┐
│     User      │     │ ConnectedUploadZone│     │    Reducer      │
└───────┬───────┘     └─────────┬──────────┘     └────────┬────────┘
        │                       │                         │
        │ 1. Drag file over     │                         │
        │──────────────────────>│                         │
        │                       │                         │
        │                       │ 2. onDragOver           │
        │                       │    e.preventDefault()   │
        │                       │    actions.setDragging(true)
        │                       │─────────────────────────>│
        │                       │                         │
        │                       │    REDUCER: SET_DRAGGING│
        │                       │    → ui.isDragging=true │
        │                       │                         │
        │ 3. (Zone highlights)  │                         │
        │<──────────────────────│                         │
        │                       │                         │
        │ 4. Drop file          │                         │
        │──────────────────────>│                         │
        │                       │                         │
        │                       │ 5. onDrop               │
        │                       │    e.preventDefault()   │
        │                       │    actions.setDragging(false)
        │                       │    handleFilesSelected(files)
        │                       │─────────────────────────>│
        │                       │                         │
        │                       │    (Same upload flow as 1.1, steps 4-15)
        │                       │                         │
```

---

## 2. File Selection

**User Steps:**
1. Upload multiple documents (see flow 1.1)
2. In the File Queue (left sidebar), click on a different file

**Expected Observations:**
- Previously selected file loses highlight
- Clicked file gets blue highlight
- Main content area updates to show the selected file's content
- Page number resets to 1
- SaveBar reflects new file's undo/redo state

**Sequence Diagram:**

```
┌───────────────┐     ┌──────────────────┐     ┌────────────────────┐     ┌───────────────┐
│     User      │     │ConnectedFileQueue│     │   IngestionPage    │     │    Reducer    │
└───────┬───────┘     └────────┬─────────┘     └─────────┬──────────┘     └───────┬───────┘
        │                      │                         │                        │
        │ 1. Click file item   │                         │                        │
        │─────────────────────>│                         │                        │
        │                      │                         │                        │
        │                      │ 2. actions.selectFile(documentId)               │
        │                      │────────────────────────────────────────────────>│
        │                      │                         │                        │
        │                      │         REDUCER: FILE_SELECTED                  │
        │                      │         → selectedDocumentId = newDocId         │
        │                      │                         │                        │
        │                      │                         │ 3. useEffect triggers │
        │                      │                         │    (selectedDocumentId changed)
        │                      │                         │<───────────────────────│
        │                      │                         │                        │
        │                      │                         │ 4. getFileContent(docId)
        │                      │                         │    (from localStorage) │
        │                      │                         │                        │
        │                      │                         │ 5. getFileHistory(docId)
        │                      │                         │    (undo/redo stack)   │
        │                      │                         │                        │
        │                      │                         │ 6. restoreCommandDocument({
        │                      │                         │      past, present, future
        │                      │                         │    })                  │
        │                      │                         │                        │
        │                      │                         │ 7. actions.loadDocument(content)
        │                      │                         │────────────────────────>│
        │                      │                         │                        │
        │                      │         REDUCER: DOCUMENT_LOADED                │
        │                      │         → documentState = content               │
        │                      │         → currentPage = 1                       │
        │                      │                         │                        │
        │ 8. UI re-renders     │                         │                        │
        │    - New file highlighted                      │                        │
        │    - New content displayed                     │                        │
        │<─────────────────────│                         │                        │
        │                      │                         │                        │
```

---

## 3. Page Navigation

**User Steps:**
1. Load a multi-page document
2. Click "Next" button (→) at the bottom of content viewer
3. Or click "Previous" button (←)
4. Or click specific page number

**Expected Observations:**
- Page indicator updates (e.g., "Page 2 of 3")
- Content area scrolls/updates to show new page's items
- Previous/Next buttons disable at boundaries (page 1 / last page)

**Sequence Diagram:**

```
┌───────────────┐     ┌──────────────────────┐     ┌───────────────┐     ┌───────────────┐
│     User      │     │ConnectedContentViewer│     │ PageNavigation│     │    Reducer    │
└───────┬───────┘     └──────────┬───────────┘     └───────┬───────┘     └───────┬───────┘
        │                        │                         │                     │
        │ 1. Click "Next"        │                         │                     │
        │───────────────────────────────────────────────>  │                     │
        │                        │                         │                     │
        │                        │  2. onPageChange(currentPage + 1)             │
        │                        │<────────────────────────│                     │
        │                        │                         │                     │
        │                        │  3. handlePageChange(newPage)                 │
        │                        │     - validate bounds   │                     │
        │                        │     - actions.changePage(newPage)             │
        │                        │─────────────────────────────────────────────>│
        │                        │                         │                     │
        │                        │         REDUCER: PAGE_CHANGED                │
        │                        │         → currentPage = newPage              │
        │                        │                         │                     │
        │ 4. UI re-renders       │                         │                     │
        │    - Page indicator    │                         │                     │
        │    - New page content  │                         │                     │
        │<───────────────────────│                         │                     │
        │                        │                         │                     │
```

---

## 4. Item Operations

### 4.1 Edit Text Item

**User Steps:**
1. Load a document with text content
2. Click on any text item (rendered as Markdown)
3. Item switches to edit mode (textarea)
4. Modify the text
5. Press Ctrl+Enter to save (or click outside to blur-save)

**Expected Observations:**
- Clicking text shows textarea with raw Markdown
- Blue border indicates edit mode
- "Ctrl+Enter to save • ESC to cancel" hint appears
- After save, Markdown re-renders
- Undo button becomes enabled
- Toast: (none for edits, silent save)

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────┐     ┌──────────────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │ TextItem  │     │ConnectedContentViewer│     │useCommandHistory│    │    Reducer    │
└───────┬───────┘     └─────┬─────┘     └──────────┬───────────┘     └────────┬───────┘     └───────┬───────┘
        │                   │                      │                          │                     │
        │ 1. Click text     │                      │                          │                     │
        │──────────────────>│                      │                          │                     │
        │                   │                      │                          │                     │
        │                   │ 2. setIsEditing(true)│                          │                     │
        │                   │    (local state)     │                          │                     │
        │                   │                      │                          │                     │
        │ 3. (Edit mode UI) │                      │                          │                     │
        │<──────────────────│                      │                          │                     │
        │                   │                      │                          │                     │
        │ 4. Type new text  │                      │                          │                     │
        │──────────────────>│                      │                          │                     │
        │                   │                      │                          │                     │
        │                   │ 5. setEditContent()  │                          │                     │
        │                   │    (local state)     │                          │                     │
        │                   │                      │                          │                     │
        │ 6. Ctrl+Enter     │                      │                          │                     │
        │──────────────────>│                      │                          │                     │
        │                   │                      │                          │                     │
        │                   │ 7. handleSave()      │                          │                     │
        │                   │    if changed:       │                          │                     │
        │                   │    onEdit(itemId, newContent)                   │                     │
        │                   │─────────────────────>│                          │                     │
        │                   │                      │                          │                     │
        │                   │                      │ 8. handleEditItem(itemId, newContent)          │
        │                   │                      │    - find oldContent     │                     │
        │                   │                      │    - Commands.editItem() │                     │
        │                   │                      │                          │                     │
        │                   │                      │ 9. executeCommand(editCommand)                 │
        │                   │                      │─────────────────────────>│                     │
        │                   │                      │                          │                     │
        │                   │                      │          10. command.execute(doc)              │
        │                   │                      │              → applyToItem(doc, itemId,        │
        │                   │                      │                 item => {..., content: new})   │
        │                   │                      │                          │                     │
        │                   │                      │          11. Push command to history.past      │
        │                   │                      │              Clear history.future              │
        │                   │                      │                          │                     │
        │                   │                      │          12. Return new documentState          │
        │                   │                      │<─────────────────────────│                     │
        │                   │                      │                          │                     │
        │                   │                      │ 13. actions.modifyDocument(newState)           │
        │                   │                      │──────────────────────────────────────────────>│
        │                   │                      │                          │                     │
        │                   │                      │          REDUCER: DOCUMENT_MODIFIED           │
        │                   │                      │          → documentState = newState           │
        │                   │                      │                          │                     │
        │                   │ 14. setIsEditing(false)                         │                     │
        │                   │                      │                          │                     │
        │ 15. UI re-renders │                      │                          │                     │
        │    - Markdown view│                      │                          │                     │
        │    - Undo enabled │                      │                          │                     │
        │<──────────────────│                      │                          │                     │
        │                   │                      │                          │                     │
```

---

### 4.2 Delete Item

**User Steps:**
1. Hover over any item (text or image)
2. Click the "🗑️ Delete" button that appears

**Expected Observations:**
- Item is removed from view immediately
- Undo button becomes enabled in the SaveBar
- Press Ctrl+Z (or click Undo) to restore the deleted item

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────┐     ┌──────────────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │ TextItem  │     │ConnectedContentViewer│     │useCommandHistory│    │    Reducer    │
└───────┬───────┘     └─────┬─────┘     └──────────┬───────────┘     └────────┬───────┘     └───────┬───────┘
        │                   │                      │                          │                     │
        │ 1. Hover item     │                      │                          │                     │
        │──────────────────>│                      │                          │                     │
        │                   │                      │                          │                     │
        │ 2. (Delete btn    │                      │                          │                     │
        │    appears)       │                      │                          │                     │
        │<──────────────────│                      │                          │                     │
        │                   │                      │                          │                     │
        │ 3. Click Delete   │                      │                          │                     │
        │──────────────────>│                      │                          │                     │
        │                   │                      │                          │                     │
        │                   │ 4. onDelete(item.id) │                          │                     │
        │                   │─────────────────────>│                          │                     │
        │                   │                      │                          │                     │
        │                   │                      │ 5. handleDeleteItem(itemId)                    │
        │                   │                      │    executeCommand(Commands.deleteItem(itemId)) │
        │                   │                      │─────────────────────────>│                     │
        │                   │                      │                          │                     │
        │                   │                      │          6. command.execute(doc)               │
        │                   │                      │             → removeItem(doc, itemId)          │
        │                   │                      │             → stores removed item for undo     │
        │                   │                      │                          │                     │
        │                   │                      │          7. Push to history.past               │
        │                   │                      │                          │                     │
        │                   │                      │ 8. actions.modifyDocument(newState)            │
        │                   │                      │──────────────────────────────────────────────>│
        │                   │                      │                          │                     │
        │ 9. UI re-renders  │                      │                          │                     │
        │    - Item removed │                      │                          │                     │
        │    - Undo enabled │                      │                          │                     │
        │<──────────────────│                      │                          │                     │
        │                   │                      │                          │                     │
```

---

### 4.3 Restore Item (via Undo)

**User Steps:**
1. After deleting an item (see 4.2)
2. Press `Ctrl+Z` (or `Cmd+Z` on Mac) or click the Undo button in SaveBar

**Expected Observations:**
- Deleted item reappears in its original position
- Undo button disables (if no more history)
- Redo button enables

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │IngestionPage │     │useCommandHistory│    │    Reducer    │
└───────┬───────┘     └───────┬───────┘     └────────┬───────┘     └───────┬───────┘
        │                     │                      │                     │
        │ 1. Press Ctrl+Z     │                      │                     │
        │────────────────────>│                      │                     │
        │                     │                      │                     │
        │                     │ 2. undo()            │                     │
        │                     │─────────────────────>│                     │
        │                     │                      │                     │
        │                     │          3. Pop deleteCommand from past    │
        │                     │             command.undo(currentState)     │
        │                     │             → re-insert removed item       │
        │                     │             Push command to future         │
        │                     │                      │                     │
        │                     │          4. Return restored state          │
        │                     │<─────────────────────│                     │
        │                     │                      │                     │
        │                     │ 5. actions.modifyDocument(restoredState)   │
        │                     │───────────────────────────────────────────>│
        │                     │                      │                     │
        │ 6. UI re-renders    │                      │                     │
        │    - Item restored  │                      │                     │
        │    - Redo enabled   │                      │                     │
        │<────────────────────│                      │                     │
        │                     │                      │                     │
```

---

### 4.4 Change Image Classification

**User Steps:**
1. Load a document with images
2. On an image item, click the classification dropdown
3. Select a new classification (e.g., "logo" → "figure")

**Expected Observations:**
- Dropdown closes
- Classification badge updates to new value
- Undo button becomes enabled

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────┐     ┌──────────────────────┐     ┌────────────────┐
│     User      │     │ ImageItem │     │ConnectedContentViewer│     │useCommandHistory│
└───────┬───────┘     └─────┬─────┘     └──────────┬───────────┘     └────────┬───────┘
        │                   │                      │                          │
        │ 1. Click dropdown │                      │                          │
        │──────────────────>│                      │                          │
        │                   │                      │                          │
        │ 2. (Options show) │                      │                          │
        │<──────────────────│                      │                          │
        │                   │                      │                          │
        │ 3. Select "figure"│                      │                          │
        │──────────────────>│                      │                          │
        │                   │                      │                          │
        │                   │ 4. onClassChange(item.id, "figure")             │
        │                   │─────────────────────>│                          │
        │                   │                      │                          │
        │                   │                      │ 5. handleClassChange(itemId, newClass)
        │                   │                      │    - find oldClass       │
        │                   │                      │    - Commands.changeClass(itemId, new, old)
        │                   │                      │─────────────────────────>│
        │                   │                      │                          │
        │                   │                      │          6. command.execute(doc)
        │                   │                      │             → applyToItem(doc, itemId,
        │                   │                      │                item => {..., classification: new})
        │                   │                      │                          │
        │ 7. UI re-renders  │                      │                          │
        │    - New badge    │                      │                          │
        │<──────────────────│                      │                          │
        │                   │                      │                          │
```

---

## 5. Undo/Redo

**User Steps:**
1. Make changes to document (edit, delete, etc.)
2. Press `Ctrl+Z` (or `Cmd+Z` on Mac) to undo
3. Press `Ctrl+Shift+Z` (or `Cmd+Shift+Z`) to redo
4. Or click Undo/Redo buttons in SaveBar

**Expected Observations:**
- Undo reverses the last change
- Redo re-applies the undone change
- Buttons enable/disable based on history availability
- Changes persist across file switches (history saved to localStorage)

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────────┐     ┌────────────────┐     ┌───────────────┐     ┌───────────────┐
│     User      │     │IngestionPage │     │useCommandHistory│    │ fileCacheManager│   │    Reducer    │
└───────┬───────┘     └───────┬───────┘     └────────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                      │                     │                     │
        │ 1. Press Ctrl+Z     │                      │                     │                     │
        │────────────────────>│                      │                     │                     │
        │                     │                      │                     │                     │
        │                     │ 2. handleKeyDown     │                     │                     │
        │                     │    if canUndo: undo()│                     │                     │
        │                     │─────────────────────>│                     │                     │
        │                     │                      │                     │                     │
        │                     │                      │ 3. Pop command from history.past          │
        │                     │                      │    command.undo(currentState)             │
        │                     │                      │    Push command to history.future         │
        │                     │                      │                     │                     │
        │                     │                      │ 4. Return previous state                  │
        │                     │<─────────────────────│                     │                     │
        │                     │                      │                     │                     │
        │                     │ 5. useEffect: commandDocumentState changed │                     │
        │                     │    actions.modifyDocument(newState)        │                     │
        │                     │────────────────────────────────────────────────────────────────>│
        │                     │                      │                     │                     │
        │                     │                      │                     │                     │
        │                     │ 6. useEffect: documentState changed        │                     │
        │                     │    saveFileContent(docId, state)           │                     │
        │                     │    saveFileHistory(docId, {past,future})   │                     │
        │                     │───────────────────────────────────────────>│                     │
        │                     │                      │                     │                     │
        │ 7. UI re-renders    │                      │                     │                     │
        │    - Previous state │                      │                     │                     │
        │    - Redo enabled   │                      │                     │                     │
        │<────────────────────│                      │                     │                     │
        │                     │                      │                     │                     │
```

---

## 6. Helper Functions

### 6.1 Remove Logos

**User Steps:**
1. Load a document with logo images (classification = "logo")
2. In the right sidebar (Helpers), click "Remove All Logos"

**Expected Observations:**
- Button shows loading state briefly
- All logo images are removed from view
- Toast: "X logo(s) removed" or "No logos found"
- **Single file loaded:** Undo button enables (can undo all at once with Ctrl+Z)
- **Multiple files loaded:** A confirmation modal pops up asking which files to apply the helper to

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │ConnectedHelperPanel│     │useCommandHistory│    │    Reducer    │
└───────┬───────┘     └─────────┬──────────┘     └────────┬───────┘     └───────┬───────┘
        │                       │                         │                     │
        │ 1. Click "Remove      │                         │                     │
        │    All Logos"         │                         │                     │
        │──────────────────────>│                         │                     │
        │                       │                         │                     │
        │                       │ 2. handleHelperClick('remove_logos')          │
        │                       │    → executeHelper('remove_logos')            │
        │                       │                         │                     │
        │                       │ 3. actions.startHelper('remove_logos')        │
        │                       │────────────────────────────────────────────>  │
        │                       │                         │                     │
        │                       │         REDUCER: HELPER_STARTED               │
        │                       │         → runningHelper = 'remove_logos'      │
        │                       │                         │                     │
        │                       │ 4. Collect logoItemIds  │                     │
        │                       │    for each page.items  │                     │
        │                       │      if type='image' && │                     │
        │                       │         classification='logo' && !deleted     │
        │                       │         → push to array │                     │
        │                       │                         │                     │
        │                       │ 5. if logoItemIds.length > 0:                 │
        │                       │    executeCommand(Commands.batchDelete(ids))  │
        │                       │─────────────────────────>│                    │
        │                       │                         │                     │
        │                       │          6. command.execute(doc)              │
        │                       │             → removeItems(doc, ids)           │
        │                       │             → stores removed items for undo   │
        │                       │                         │                     │
        │                       │ 7. toast.success("X logo(s) removed")         │
        │                       │                         │                     │
        │                       │ 8. actions.completeHelper()                   │
        │                       │────────────────────────────────────────────>  │
        │                       │                         │                     │
        │                       │         REDUCER: HELPER_COMPLETED             │
        │                       │         → runningHelper = null                │
        │                       │                         │                     │
        │ 9. UI re-renders      │                         │                     │
        │    - Logos removed    │                         │                     │
        │    - Undo enabled     │                         │                     │
        │<──────────────────────│                         │                     │
        │                       │                         │                     │
```

---

### 6.2 Remove Empty Text

**User Steps:**
1. Load a document with empty or very short text items
2. Click "Remove Empty Text" helper

**Expected Observations:**
- Text items with empty/whitespace-only content are removed from view
- Toast: "X empty item(s) removed" or "No empty items found"
- **Single file loaded:** Undo button enables (can restore all with Ctrl+Z)
- **Multiple files loaded:** A confirmation modal pops up asking which files to apply the helper to

**Sequence Diagram:**
Same as 6.1, but:
- Collects items where `type='text'` and `content.trim().length <= 1`
- Uses `Commands.batchDelete(emptyItemIds)`

---

### 6.3 Delete by Regex

**User Steps:**
1. Click "Delete by Regex" helper
2. In the modal, enter a regex pattern (e.g., `^Page \d+$`)
3. Click "Confirm" or press Enter

**Expected Observations:**
- Modal opens with text input
- After confirm, all text items matching regex are removed from view
- Toast: "X item(s) matched and deleted" or "No items matched"
- **Single file loaded:** Undo button enables (can restore all with Ctrl+Z)
- **Multiple files loaded:** A confirmation modal pops up first asking which files to apply the helper to

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │ConnectedHelperPanel│     │  RegexModal    │     │IngestionPage  │
└───────┬───────┘     └─────────┬──────────┘     └────────┬───────┘     └───────┬───────┘
        │                       │                         │                     │
        │ 1. Click "Delete by   │                         │                     │
        │    Regex"             │                         │                     │
        │──────────────────────>│                         │                     │
        │                       │                         │                     │
        │                       │ 2. actions.openModal(MODAL_TYPES.REGEX)       │
        │                       │──────────────────────────────────────────────>│
        │                       │                         │                     │
        │                       │         REDUCER: MODAL_OPENED                 │
        │                       │         → activeModal = 'REGEX'               │
        │                       │                         │                     │
        │ 3. (Modal opens)      │                         │                     │
        │<──────────────────────│                         │                     │
        │                       │                         │                     │
        │ 4. Type pattern,      │                         │                     │
        │    click Confirm      │                         │                     │
        │────────────────────────────────────────────────>│                     │
        │                       │                         │                     │
        │                       │                         │ 5. onConfirm(pattern)
        │                       │                         │────────────────────>│
        │                       │                         │                     │
        │                       │                         │     6. handleRegexConfirm(pattern)
        │                       │                         │        const regex = new RegExp(pattern)
        │                       │                         │        for each text item:
        │                       │                         │          if regex.test(content)
        │                       │                         │            → matchingIds.push(id)
        │                       │                         │                     │
        │                       │                         │     7. if matches:  │
        │                       │                         │        executeCommand(Commands.batchDelete)
        │                       │                         │        toast.success("X items matched")
        │                       │                         │                     │
        │                       │                         │     8. actions.closeModal()
        │                       │                         │                     │
        │ 9. Modal closes,      │                         │                     │
        │    items deleted      │                         │                     │
        │<──────────────────────│                         │                     │
        │                       │                         │                     │
```

---

### 6.4 AI Image Descriptions

**User Steps:**
1. Load a document with images
2. Click "Generate Image Descriptions (AI)" helper

**Expected Observations:**
- Button shows loading/spinner
- For each image, a new text item appears below it with "**Image Description:** ..."
- Toast: "Generated descriptions for X image(s)"
- New text items can be edited/deleted

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│     User      │     │ConnectedHelperPanel│     │  ingestionApi   │     │ Ingestion Svc │     │  LLM Service │
└───────┬───────┘     └─────────┬──────────┘     └────────┬────────┘     └───────┬───────┘     └──────┬───────┘
        │                       │                         │                      │                    │
        │ 1. Click "Generate    │                         │                      │                    │
        │    Image Desc (AI)"   │                         │                      │                    │
        │──────────────────────>│                         │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 2. executeHelper('ai_image_descriptions')      │                    │
        │                       │    actions.startHelper()│                      │                    │
        │                       │                         │                      │                    │
        │                       │ 3. Collect images from documentState           │                    │
        │                       │    for each page.items where type='image'|'picture' && !deleted     │
        │                       │    → images.push({id, imageUrl, classification, pageNumber})        │
        │                       │                         │                      │                    │
        │                       │ 4. POST /api/ingestion/helper/image-descriptions                    │
        │                       │    { documentId, images }                      │                    │
        │                       │─────────────────────────>│                     │                    │
        │                       │                         │                      │                    │
        │                       │                         │ 5. generateImageDescriptionsFromImages()  │
        │                       │                         │─────────────────────>│                    │
        │                       │                         │                      │                    │
        │                       │                         │                      │ 6. [TODO] Call LLM
        │                       │                         │                      │───────────────────>│
        │                       │                         │                      │                    │
        │                       │                         │                      │ 7. [MOCK] Return   │
        │                       │                         │                      │    mock descriptions
        │                       │                         │                      │    based on classification
        │                       │                         │<─────────────────────│                    │
        │                       │                         │                      │                    │
        │                       │ 8. Response: { success, descriptions: [...] }  │                    │
        │                       │<─────────────────────────│                     │                    │
        │                       │                         │                      │                    │
        │                       │ 9. Create insertions = descriptions.map(d => ({                     │
        │                       │      afterItemId: d.imageId,                   │                    │
        │                       │      newItem: { id: 'desc_...', type: 'text',  │                    │
        │                       │                 content: '**Image Description:** ...' }            │
        │                       │    }))                  │                      │                    │
        │                       │                         │                      │                    │
        │                       │ 10. executeCommand(Commands.batchInsertAfter(insertions))           │
        │                       │                         │                      │                    │
        │                       │          command.execute(doc):                 │                    │
        │                       │          → insertItemsAfter(doc, insertions)   │                    │
        │                       │          → for each insertion, find afterItemId in page.items       │
        │                       │          → splice newItem after it             │                    │
        │                       │                         │                      │                    │
        │                       │ 11. toast.success("Generated descriptions for X image(s)")          │
        │                       │                         │                      │                    │
        │                       │ 12. actions.completeHelper()                   │                    │
        │                       │                         │                      │                    │
        │ 13. UI re-renders     │                         │                      │                    │
        │    - New text items   │                         │                      │                    │
        │      below images     │                         │                      │                    │
        │<──────────────────────│                         │                      │                    │
        │                       │                         │                      │                    │
```

---

### 6.5 Multi-File Helper

**User Steps:**
1. Upload multiple documents
2. Click any helper (e.g., "Remove All Logos")
3. File selection modal appears
4. Select which files to apply helper to
5. Click "Apply"

**Expected Observations:**
- Modal shows all "ready" files with checkboxes
- Current file is pre-selected
- After apply, helper runs on all selected files
- Toast: "X logo(s) removed from Y file(s)"
- All affected files' histories updated (undo available when switching)

**Sequence Diagram:**

```
┌───────────────┐     ┌────────────────────┐     ┌────────────────────┐     ┌───────────────┐
│     User      │     │ConnectedHelperPanel│     │HelperFileSelectModal│    │IngestionPage  │
└───────┬───────┘     └─────────┬──────────┘     └─────────┬──────────┘     └───────┬───────┘
        │                       │                          │                        │
        │ 1. Click helper       │                          │                        │
        │──────────────────────>│                          │                        │
        │                       │                          │                        │
        │                       │ 2. if readyFiles.length > 1:                      │
        │                       │    actions.setPendingHelper(helper)               │
        │                       │    actions.openHelperFileSelectModal()            │
        │                       │─────────────────────────────────────────────────>│
        │                       │                          │                        │
        │ 3. (Modal opens)      │                          │                        │
        │<──────────────────────│                          │                        │
        │                       │                          │                        │
        │ 4. Select files,      │                          │                        │
        │    click Apply        │                          │                        │
        │──────────────────────────────────────────────>  │                        │
        │                       │                          │                        │
        │                       │                          │ 5. onConfirm(selectedDocIds)
        │                       │                          │───────────────────────>│
        │                       │                          │                        │
        │                       │                          │     6. handleHelperFileSelectConfirm()
        │                       │                          │        for each docId: │
        │                       │                          │          getFileContent(docId)
        │                       │                          │          collect affected items
        │                       │                          │          create command  │
        │                       │                          │          if current doc: │
        │                       │                          │            executeCommand()
        │                       │                          │          else:          │
        │                       │                          │            command.execute()
        │                       │                          │            saveFileContent()
        │                       │                          │            saveFileHistory()
        │                       │                          │                        │
        │                       │                          │     7. toast result    │
        │                       │                          │        actions.clearPendingHelper()
        │                       │                          │                        │
        │ 8. Modal closes,      │                          │                        │
        │    changes applied    │                          │                        │
        │<──────────────────────│                          │                        │
        │                       │                          │                        │
```

---

## 7. Preview & Ingestion

### 7.1 Single File Ingestion

**User Steps:**
1. Load a document and make edits
2. In SaveBar, click "Ingest" button
3. In modal, select target database and strategy
4. Click "Show Preview"
5. Review embedding preview
6. Click "Confirm & Ingest"

**Expected Observations:**
- Modal opens with DB/strategy options
- Preview shows chunked content with metadata
- After confirm, progress indicator shows
- Toast: "Document ingested successfully to {targetDb}"
- File moves from "uploaded" to "ingested" section
- Right sidebar collapses during preview mode

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│     User      │     │IngestionPage │     │  ingestionApi   │     │ Ingestion Svc │     │    Reducer   │
└───────┬───────┘     └───────┬───────┘     └────────┬────────┘     └───────┬───────┘     └──────┬───────┘
        │                     │                      │                      │                    │
        │ 1. Click "Ingest"   │                      │                      │                    │
        │────────────────────>│                      │                      │                    │
        │                     │                      │                      │                    │
        │                     │ 2. actions.openModal(MODAL_TYPES.INGEST)    │                    │
        │                     │─────────────────────────────────────────────────────────────────>│
        │                     │                      │                      │                    │
        │ 3. (Modal opens)    │                      │                      │                    │
        │<────────────────────│                      │                      │                    │
        │                     │                      │                      │                    │
        │ 4. Select DB,       │                      │                      │                    │
        │    strategy,        │                      │                      │                    │
        │    click Preview    │                      │                      │                    │
        │────────────────────>│                      │                      │                    │
        │                     │                      │                      │                    │
        │                     │ 5. handleShowPreview(targetDb, strategy)    │                    │
        │                     │    actions.startPreview()                   │                    │
        │                     │─────────────────────────────────────────────────────────────────>│
        │                     │                      │                      │                    │
        │                     │         REDUCER: PREVIEW_STARTED            │                    │
        │                     │         → isPreviewMode = true              │                    │
        │                     │         → isLoadingPreview = true           │                    │
        │                     │         → rightSidebarCollapsed = true (saved prev state)       │
        │                     │                      │                      │                    │
        │                     │ 6. POST /api/ingestion/preview              │                    │
        │                     │    { strategy, documentState }              │                    │
        │                     │─────────────────────>│                      │                    │
        │                     │                      │                      │                    │
        │                     │                      │ 7. generateEmbeddingPreview()             │
        │                     │                      │─────────────────────>│                    │
        │                     │                      │                      │                    │
        │                     │                      │ 8. Return { documents: [...], metadata }  │
        │                     │                      │<─────────────────────│                    │
        │                     │                      │                      │                    │
        │                     │ 9. actions.setPreviewGenerated(preview)     │                    │
        │                     │─────────────────────────────────────────────────────────────────>│
        │                     │                      │                      │                    │
        │                     │         REDUCER: PREVIEW_GENERATED          │                    │
        │                     │         → embeddingPreview = preview        │                    │
        │                     │         → isLoadingPreview = false          │                    │
        │                     │                      │                      │                    │
        │ 10. (Preview shows) │                      │                      │                    │
        │<────────────────────│                      │                      │                    │
        │                     │                      │                      │                    │
        │ 11. Click "Confirm  │                      │                      │                    │
        │     & Ingest"       │                      │                      │                    │
        │────────────────────>│                      │                      │                    │
        │                     │                      │                      │                    │
        │                     │ 12. handleConfirmIngestion()                │                    │
        │                     │     actions.startIngestion()                │                    │
        │                     │─────────────────────────────────────────────────────────────────>│
        │                     │                      │                      │                    │
        │                     │         REDUCER: INGESTION_STARTED          │                    │
        │                     │         → isIngesting = true                │                    │
        │                     │                      │                      │                    │
        │                     │ 13. POST /api/ingestion/ingest              │                    │
        │                     │     { targetDb, documentState, strategy }   │                    │
        │                     │─────────────────────>│                      │                    │
        │                     │                      │                      │                    │
        │                     │                      │ 14. ingestToVectorDb()                    │
        │                     │                      │─────────────────────>│                    │
        │                     │                      │                      │                    │
        │                     │                      │ 15. [MOCK] Return success                 │
        │                     │                      │<─────────────────────│                    │
        │                     │                      │                      │                    │
        │                     │ 16. createIngestedFile() in localStorage    │                    │
        │                     │                      │                      │                    │
        │                     │ 17. actions.completeIngestion()             │                    │
        │                     │─────────────────────────────────────────────────────────────────>│
        │                     │                      │                      │                    │
        │                     │         REDUCER: INGESTION_COMPLETE         │                    │
        │                     │         → uploadQueue: remove file          │                    │
        │                     │         → ingestedFiles: add entry          │                    │
        │                     │         → isPreviewMode = false             │                    │
        │                     │         → restore rightSidebarCollapsed     │                    │
        │                     │                      │                      │                    │
        │                     │ 18. toast.success("Ingested to {targetDb}") │                    │
        │                     │                      │                      │                    │
        │ 19. UI returns to   │                      │                      │                    │
        │     normal editor   │                      │                      │                    │
        │     mode            │                      │                      │                    │
        │<────────────────────│                      │                      │                    │
        │                     │                      │                      │                    │
```

---

### 7.2 Multi-File Ingestion

**User Steps:**
1. Upload multiple documents
2. Enable "Multi-Select" toggle
3. Check multiple files in the queue
4. Click "Ingest" → "Show Preview" → "Confirm All"

**Expected Observations:**
- All checked files are included in preview
- Preview shows combined embedding count
- "Confirm All" button appears (instead of single "Confirm")
- Progress shows percentage through files
- Toast: "Successfully ingested X file(s)"

**Sequence Diagram:**
Similar to 7.1, but:
- `previewDocumentIds` is a Set of multiple IDs
- `handleConfirmIngestionAll()` loops through all files
- `actions.completeBatchIngestion(entries)` is called at end

---

## 8. Sidebar Toggle

**User Steps:**
1. Click the collapse button (« or ») on left or right sidebar

**Expected Observations:**
- Sidebar collapses to narrow strip with icon
- Main content area expands
- Click again to expand
- State persists during session

**Sequence Diagram:**

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     User      │     │IngestionPage │     │    Reducer    │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │ 1. Click «          │                     │
        │────────────────────>│                     │
        │                     │                     │
        │                     │ 2. actions.toggleLeftSidebar()
        │                     │────────────────────>│
        │                     │                     │
        │                     │     REDUCER: TOGGLE_LEFT_SIDEBAR
        │                     │     → leftSidebarCollapsed = !current
        │                     │                     │
        │ 3. Sidebar collapses│                     │
        │<────────────────────│                     │
        │                     │                     │
```

---

## 9. Cache Management

**User Steps:**
1. Click "Manage Cache" button at bottom of file queue
2. In modal, view cache statistics
3. Click "Clear Uploaded Files" or "Clear All"
4. Confirm in dialog

**Expected Observations:**
- Modal shows storage used, file counts
- After clear, respective sections empty
- Toast: "Cache cleared successfully"
- File queue and/or ingested list empties

**Sequence Diagram:**

```
┌───────────────┐     ┌─────────────────┐     ┌────────────────┐     ┌───────────────┐
│     User      │     │CacheManagement │     │fileCacheManager│     │IngestionPage  │
└───────┬───────┘     └────────┬────────┘     └────────┬───────┘     └───────┬───────┘
        │                      │                       │                     │
        │ 1. Click "Clear All" │                       │                     │
        │─────────────────────>│                       │                     │
        │                      │                       │                     │
        │                      │ 2. window.confirm()   │                     │
        │ 3. Click OK          │                       │                     │
        │─────────────────────>│                       │                     │
        │                      │                       │                     │
        │                      │ 3. clearAllFileCache()│                     │
        │                      │──────────────────────>│                     │
        │                      │                       │                     │
        │                      │       localStorage.removeItem(...)          │
        │                      │       for uploaded, ingested, content, history
        │                      │                       │                     │
        │                      │ 4. onCacheCleared()   │                     │
        │                      │──────────────────────────────────────────>  │
        │                      │                       │                     │
        │                      │       5. actions.clearAllFiles()            │
        │                      │          resetCommandDocument(null)         │
        │                      │                       │                     │
        │                      │           REDUCER: CLEAR_ALL_FILES          │
        │                      │           → uploadQueue = []                │
        │                      │           → ingestedFiles = []              │
        │                      │           → documentState = null            │
        │                      │                       │                     │
        │                      │ 6. toast.success("Cache cleared")           │
        │                      │                       │                     │
        │ 7. UI empties        │                       │                     │
        │<─────────────────────│                       │                     │
        │                      │                       │                     │
```

---

## State Summary Table

| Flow | Context Hooks Used | Actions Dispatched | API Called | Commands Used |
|------|-------------------|-------------------|------------|---------------|
| Upload | `useUI`, `useFileQueue`, `useIngestionActions` | `startFileUpload`, `completeFileUpload`, `selectFile` | `POST /upload` | - |
| File Select | `useFileQueue`, `useDocument`, `useIngestionActions` | `selectFile`, `loadDocument` | - | - |
| Page Nav | `useDocument`, `useIngestionActions` | `changePage` | - | - |
| Edit Item | `useDocument` | `modifyDocument` | - | `Commands.editItem` |
| Delete Item | `useDocument` | `modifyDocument` | - | `Commands.deleteItem` |
| Restore Item | `useDocument` | `modifyDocument` | - | `Commands.restoreItem` |
| Change Class | `useDocument` | `modifyDocument` | - | `Commands.changeClass` |
| Undo/Redo | - | `modifyDocument` | - | `history.past/future` |
| Remove Logos | `useUI`, `useDocument`, `useIngestionActions` | `startHelper`, `completeHelper`, `modifyDocument` | - | `Commands.batchDelete` |
| Remove Empty | `useUI`, `useDocument`, `useIngestionActions` | `startHelper`, `completeHelper`, `modifyDocument` | - | `Commands.batchDelete` |
| Delete Regex | `useUI`, `useDocument`, `useIngestionActions` | `openModal`, `closeModal`, `modifyDocument` | - | `Commands.batchDelete` |
| AI Image Desc | `useUI`, `useDocument`, `useIngestionActions` | `startHelper`, `completeHelper`, `modifyDocument` | `POST /helper/image-descriptions` | `Commands.batchInsertAfter` |
| Preview | `useUI`, `usePreview`, `useIngestionActions` | `startPreview`, `setPreviewGenerated` | `POST /preview` | - |
| Ingest | `useUI`, `usePreview`, `useIngestionActions` | `startIngestion`, `completeIngestion` | `POST /ingest` | - |
| Toggle Sidebar | `useUI`, `useIngestionActions` | `toggleLeftSidebar`, `toggleRightSidebar` | - | - |
| Clear Cache | `useFileQueue`, `useIngestionActions` | `clearAllFiles` | - | - |

---

## Mock Data Note

All backend endpoints currently return **mock data**. The LLM service integration is TODO.

| Endpoint | Mock Behavior |
|----------|---------------|
| `POST /upload` | Returns `generateMockContent()` with 3 sample pages |
| `POST /preview` | Returns `generateEmbeddingPreview()` (runs real logic locally) |
| `POST /ingest` | Returns success without actually ingesting |
| `POST /helper/image-descriptions` | Returns classification-aware mock descriptions |

See `doc/ingestion/API_CONTRACTS.md` for full API documentation.
