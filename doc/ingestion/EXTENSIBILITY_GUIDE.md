# Ingestion Page Extensibility Guide

This document describes how to extend the Ingestion Page functionality in the frontend. The architecture is designed with extensibility in mind, using configuration-driven patterns that allow adding new features without modifying core logic.

## Table of Contents

1. [Adding New File Types](#1-adding-new-file-types)
2. [Adding Helper Functions](#2-adding-helper-functions)
3. [Adding Ingestion Strategies](#3-adding-ingestion-strategies)
4. [Adding New Commands (Undo/Redo)](#4-adding-new-commands-undoredo)
5. [Adding New Modals](#5-adding-new-modals)
6. [Adding New UI State](#6-adding-new-ui-state)
7. [Extending LocalStorage Cache](#7-extending-localstorage-cache)
8. [Configuration Reference](#8-configuration-reference)

---

## 1. Adding New File Types

### Overview

File type validation is centralized in `ingestionConfig.js`. When a user uploads a file, the flow is:

```
User drops/selects file
    ↓
ConnectedUploadZone.handleFilesSelected()
    ↓
validateFiles() → isValidFileType() → INGESTION_CONFIG.upload.allowedTypes
    ↓
If valid → uploadDocument() API call
```

### How to Add a New File Type

**File:** `frontend/src/config/ingestionConfig.js`

```javascript
export const INGESTION_CONFIG = {
    upload: {
        maxFileSizeMB: 10,
        // Step 1: Add file extension
        allowedTypes: ['.pdf', '.pptx', '.docx'],  // ← Add here
        // Step 2: Add MIME type
        allowedMimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // .pptx
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    // .docx
        ],
        maxConcurrentUploads: 3,
    },
    // ...
};
```

**Also update the upload zone accept attribute:**

**File:** `frontend/src/components/ingestion/ConnectedUploadZone.jsx`

```jsx
<input
    id="file-upload-input"
    type="file"
    className="hidden"
    accept=".pdf,.pptx,.docx"  // ← Update this to match allowedTypes
    multiple
    onChange={handleFileInputChange}
    disabled={disabled}
/>
```

### Validation Functions Used

| Function | Location | Purpose |
|----------|----------|---------|
| `isValidFileType(file)` | `ingestionConfig.js` | Checks extension and MIME type |
| `isValidFileSize(file)` | `ingestionConfig.js` | Checks file size against limit |
| `getFileSizeLimitText()` | `ingestionConfig.js` | Returns human-readable size limit |
| `getAllowedTypesText()` | `ingestionConfig.js` | Returns allowed types as string |

### Backend Consideration

The backend ingestion service must also support the new file type. Check `backend/ingestion/` and `backend/llm/` for file processing logic.

---

## 2. Adding Helper Functions

### Overview

Helper functions are tools that modify document content (remove logos, clean text, etc.). They are divided into:

- **Local helpers**: Run entirely in the browser (fast, no API call)
- **Backend helpers**: Require AI/LLM processing (call backend API)

### Complete Checklist: Adding a New LOCAL Helper

A local helper runs entirely in the frontend browser. Follow ALL steps:

| Step | File | Action |
|------|------|--------|
| 1 | `frontend/src/config/ingestionConfig.js` | Add helper to `helpers.local` array |
| 2 | `frontend/src/hooks/useLocalHelper.js` | Add helper ID to `LOCAL_HELPERS` array |
| 3 | `frontend/src/hooks/useLocalHelper.js` | Add finder function (e.g., `findHeaderItems`) |
| 4 | `frontend/src/hooks/useLocalHelper.js` | Add case in `executeLocalHelper()` switch |
| 5 | `backend/ingestion/config/localConfig.json` | Add helper to `helpers.localHelpers` array |

**Step 1: Frontend Config Registry**

```javascript
// frontend/src/config/ingestionConfig.js → helpers.local
{
    id: 'remove_headers',
    label: 'Remove Headers/Footers',
    description: 'Delete text items marked as headers or footers',
    type: 'local',
    icon: '📋',
},
```

**Step 2: Add to LOCAL_HELPERS constant**

```javascript
// frontend/src/hooks/useLocalHelper.js
export const LOCAL_HELPERS = ['remove_logos', 'remove_empty', 'delete_regex', 'remove_headers'];
```

**Step 3: Add finder function**

```javascript
// frontend/src/hooks/useLocalHelper.js
export const findHeaderItems = (documentState) => {
    const itemIds = [];
    if (!documentState?.pages) return itemIds;

    for (const page of documentState.pages) {
        for (const item of page.items || []) {
            if (item.type === 'text' && 
                (item.classification === 'header' || item.classification === 'footer') && 
                !item.deleted) {
                itemIds.push(item.id);
            }
        }
    }
    return itemIds;
};
```

**Step 4: Add switch case in executeLocalHelper**

```javascript
// frontend/src/hooks/useLocalHelper.js → executeLocalHelper()
case 'remove_headers': {
    const itemIds = findHeaderItems(documentState);
    const message = itemIds.length > 0
        ? `${itemIds.length} header/footer(s) removed`
        : 'No headers/footers found';
    return { itemIds, message };
}
```

**Step 5: Backend Config (for API response consistency)**

```json
// backend/ingestion/config/localConfig.json → helpers.localHelpers
{
    "id": "remove_headers",
    "label": "Remove Headers/Footers",
    "description": "Delete text items marked as headers or footers",
    "type": "local",
    "enabled": true,
    "icon": "📋",
    "input_type": "text",
    "output_type": "deletion"
}
```

---

### Complete Checklist: Adding a New BACKEND Helper

A backend helper requires AI/LLM processing via the backend services. Follow ALL steps:

| Step | File | Action |
|------|------|--------|
| 1 | `frontend/src/config/ingestionConfig.js` | Add helper to `helpers.backend` array |
| 2 | `backend/llm/config/ingestion_config.json` | Add helper to `helpers.items` array |
| 3 | `frontend/src/components/ingestion/connected/ConnectedHelperPanel.jsx` | Add case in `executeHelper()` switch |
| 4 | `backend/llm/routes/ingestion_routes.py` | Add endpoint handler |
| 5 | `backend/llm/controllers/ingestion_controller.py` | Implement AI logic |
| 6 | `backend/ingestion/controllers/ingestionController.js` | Add proxy handler (if needed) |

**Step 1: Frontend Config Registry**

```javascript
// frontend/src/config/ingestionConfig.js → helpers.backend
{
    id: 'ai_summarize_pages',
    label: 'Summarize Pages (AI)',
    description: 'Use AI to generate a summary for each page',
    type: 'backend',
    icon: '📝',
},
```

**Step 2: LLM Service Config**

```json
// backend/llm/config/ingestion_config.json → helpers.items
{
    "id": "ai_summarize_pages",
    "label": "AI Summarize Pages",
    "description": "Uses LLM to generate a summary for each page",
    "type": "backend",
    "enabled": true,
    "icon": "📝",
    "endpoint": "/api/ingestion/helper/ai_summarize_pages",
    "input_type": "pages",
    "output_type": "summaries",
    "requires_llm": true
}
```

**Step 3: Frontend Handler**

```javascript
// frontend/src/components/ingestion/connected/ConnectedHelperPanel.jsx → executeHelper()
case 'ai_summarize_pages': {
    const result = await runBackendHelper(helperId, documentState, {});
    if (result.success && result.modifiedItems) {
        const insertions = result.modifiedItems.map(m => ({
            afterItemId: m.id,
            newItem: {
                id: `summary_${m.id}_${Date.now()}`,
                type: 'text',
                content: `**Summary:** ${m.summary}`,
                deleted: false,
            },
        }));
        executeCommand(Commands.batchInsertAfter(insertions));
    }
    message = result.message || 'AI summaries generated';
    break;
}
```

**Step 4: LLM Service Route**

```python
# backend/llm/routes/ingestion_routes.py
@router.post("/helper/ai_summarize_pages")
async def ai_summarize_pages(request: SummarizePagesRequest):
    controller = IngestionController()
    return await controller.summarize_pages(request.document_state)
```

**Step 5: LLM Service Controller**

```python
# backend/llm/controllers/ingestion_controller.py
async def summarize_pages(self, document_state: dict) -> dict:
    summaries = []
    for page in document_state.get("pages", []):
        text = " ".join(item["content"] for item in page.get("items", []) 
                       if item.get("type") == "text")
        summary = await self.llm.generate(f"Summarize: {text}")
        summaries.append({"pageNumber": page["pageNumber"], "summary": summary})
    return {"success": True, "summaries": summaries}
```

---

### Helpers with User Input (e.g., Regex)

For helpers that need user input, use `hasInput: true` and open a modal:

```javascript
{
    id: 'find_replace',
    label: 'Find & Replace...',
    description: 'Find and replace text patterns',
    type: 'local',
    hasInput: true,  // Shows "..." indicator
    icon: '🔄',
},

// In ConnectedHelperPanel.jsx → handleHelperClick():
if (helperId === 'find_replace') {
    actions.openModal(MODAL_TYPES.FIND_REPLACE);
    return;
}
```

---

## 3. Adding Ingestion Strategies

### Overview

Ingestion strategies define how document content is converted to embeddings:

- **Local strategies**: Processing happens in browser (chunking logic in `useLocalStrategy.js`)
- **Backend strategies**: Processing requires AI (semantic analysis via LLM service)

### Complete Checklist: Adding a New LOCAL Strategy

A local strategy runs entirely in the frontend browser. Follow ALL steps:

| Step | File | Action |
|------|------|--------|
| 1 | `frontend/src/config/ingestionConfig.js` | Add strategy to `strategies.local` array |
| 2 | `frontend/src/hooks/useLocalStrategy.js` | Add strategy ID to `LOCAL_STRATEGIES` array |
| 3 | `frontend/src/hooks/useLocalStrategy.js` | Add generation function (e.g., `generateSentenceEmbeddings`) |
| 4 | `frontend/src/hooks/useLocalStrategy.js` | Add case in `generateLocalPreview()` |
| 5 | `backend/ingestion/config/localConfig.json` | Add strategy to `strategies.localStrategies` array |
| 6 | `frontend/src/components/ingestion/modals/IngestionModal.jsx` | Add icon to `STRATEGY_ICONS` (optional) |

**Step 1: Frontend Config Registry**

```javascript
// frontend/src/config/ingestionConfig.js → strategies.local
{
    id: 'chunked_sentences',
    label: 'Sentence-Based Chunks',
    description: 'Split into chunks at sentence boundaries',
    type: 'local',
    icon: '📝',
},
```

**Step 2: Add to LOCAL_STRATEGIES constant**

```javascript
// frontend/src/hooks/useLocalStrategy.js
export const LOCAL_STRATEGIES = ['embed_per_page', 'chunked_fixed', 'chunked_document', 'chunked_sentences'];
```

**Step 3: Add generation function**

```javascript
// frontend/src/hooks/useLocalStrategy.js
const generateSentenceEmbeddings = (documentState, fileHash, filename) => {
    const documents = [];
    const allContent = (documentState.pages || []).flatMap(page =>
        (page.items || [])
            .filter(item => !item.deleted && item.type === 'text')
            .map(item => item.content)
    ).join(' ');

    // Split by sentence boundaries
    const sentences = allContent.split(/(?<=[.!?])\s+/);
    let chunkIndex = 1;
    
    for (const sentence of sentences) {
        if (sentence.trim()) {
            documents.push({
                id: `${fileHash}_sentence_${chunkIndex}`,
                content: sentence.trim(),
                metadata: {
                    chunk_index: chunkIndex,
                    source: filename,
                    document_type: 'pdf',
                    char_count: sentence.length,
                },
            });
            chunkIndex++;
        }
    }
    return documents;
};
```

**Step 4: Add case in generateLocalPreview**

```javascript
// frontend/src/hooks/useLocalStrategy.js → generateLocalPreview()
} else if (strategy === 'chunked_sentences') {
    documents = generateSentenceEmbeddings(documentState, fileHash, filename);
}
```

**Step 5: Backend Config (for API response consistency)**

```json
// backend/ingestion/config/localConfig.json → strategies.localStrategies
{
    "id": "chunked_sentences",
    "label": "Sentence-Based Chunks",
    "description": "Split into chunks at sentence boundaries",
    "type": "local",
    "enabled": true,
    "features": ["natural boundaries", "sentence-level"]
}
```

**Step 6: Add Icon (optional)**

```javascript
// frontend/src/components/ingestion/modals/IngestionModal.jsx → STRATEGY_ICONS
chunked_sentences: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="..." />
    </svg>
),
```

---

### Complete Checklist: Adding a New BACKEND Strategy

A backend strategy requires AI/LLM processing. Follow ALL steps:

| Step | File | Action |
|------|------|--------|
| 1 | `frontend/src/config/ingestionConfig.js` | Add strategy to `strategies.backend` array |
| 2 | `backend/llm/config/ingestion_config.json` | Add strategy to `strategies.items` array |
| 3 | `backend/llm/routes/ingestion_routes.py` | Add endpoint handler |
| 4 | `backend/llm/controllers/ingestion_controller.py` | Implement AI logic |
| 5 | `frontend/src/components/ingestion/modals/IngestionModal.jsx` | Add icon to `STRATEGY_ICONS` (optional) |

**Step 1: Frontend Config Registry**

```javascript
// frontend/src/config/ingestionConfig.js → strategies.backend
{
    id: 'semantic_sections',
    label: 'Semantic Sections (AI)',
    description: 'Use AI to detect topic boundaries and split accordingly',
    type: 'backend',
    icon: '🤖',
    status: 'development',  // 'enabled', 'development', 'coming_soon'
},
```

**Step 2: LLM Service Config**

```json
// backend/llm/config/ingestion_config.json → strategies.items
{
    "id": "semantic_sections",
    "label": "Semantic Sections (AI)",
    "description": "AI identifies logical sections based on content meaning",
    "type": "backend",
    "enabled": true,
    "endpoint": "/api/ingestion/strategy/semantic_sections",
    "features": ["context-aware boundaries", "topic detection"],
    "requires_llm": true
}
```

**Step 3: LLM Service Route**

```python
# backend/llm/routes/ingestion_routes.py
@router.post("/strategy/semantic_sections")
async def semantic_sections_strategy(request: StrategyRequest):
    controller = IngestionController()
    return await controller.run_strategy("semantic_sections", request.document_state)
```

**Step 4: LLM Service Controller**

```python
# backend/llm/controllers/ingestion_controller.py
async def _run_semantic_sections(self, document_state: dict, options: dict) -> dict:
    # Use LLM to identify topic boundaries
    # Return chunked documents with semantic groupings
    pass
```

---

### Strategy Status Control

Use the `status` field to control availability:

| Status | Behavior |
|--------|----------|
| `'enabled'` | Available for use |
| `'development'` | Available but marked as beta |
| `'coming_soon'` | Hidden from selection |

---

### Utility Functions

```javascript
import { 
    isLocalStrategy, 
    isBackendStrategy, 
    getEnabledStrategies,
    getStrategyById 
} from '../config/ingestionConfig';

import {
    isLocalStrategy as isLocal,
    generateLocalPreview,
    LOCAL_STRATEGIES
} from '../hooks/useLocalStrategy';

// Check if strategy runs locally
if (isLocal('embed_per_page')) { /* local processing */ }

// Get all available strategies
const available = getEnabledStrategies();
```

---

## 4. Adding New Commands (Undo/Redo)

### Overview

The Command Pattern enables undo/redo with memory efficiency. Each command has:
- `execute(doc)`: Apply the change, return new state
- `undo(doc)`: Reverse the change, return previous state

### Command Factory

**File:** `frontend/src/hooks/useCommandHistory.js`

```javascript
export const Commands = {
    // Existing commands:
    editItem: (itemId, newContent, oldContent) => ({...}),
    deleteItem: (itemId) => ({...}),
    restoreItem: (itemId) => ({...}),
    changeClass: (itemId, newClass, oldClass) => ({...}),
    batchDelete: (itemIds) => ({...}),
    renameDocument: (newFilename, oldFilename) => ({...}),
    batchUpdate: (changes) => ({...}),
};
```

### Adding a New Command

**Step 1:** Add command factory function

```javascript
// In useCommandHistory.js → Commands object

/**
 * Merge multiple items into one
 */
mergeItems: (targetItemId, sourceItemIds, mergedContent, originalContents) => ({
    type: 'MERGE_ITEMS',
    targetItemId,
    sourceItemIds,
    mergedContent,
    originalContents,  // Map of itemId → original content
    execute: (doc) => {
        // Delete source items, update target with merged content
        let result = doc;
        for (const sourceId of sourceItemIds) {
            result = applyToItem(result, sourceId, (item) => ({ ...item, deleted: true }));
        }
        result = applyToItem(result, targetItemId, (item) => ({ 
            ...item, 
            content: mergedContent 
        }));
        return result;
    },
    undo: (doc) => {
        // Restore source items, restore target's original content
        let result = doc;
        for (const sourceId of sourceItemIds) {
            result = applyToItem(result, sourceId, (item) => ({ ...item, deleted: false }));
        }
        result = applyToItem(result, targetItemId, (item) => ({ 
            ...item, 
            content: originalContents[targetItemId] 
        }));
        return result;
    },
}),
```

**Step 2:** Add deserialization (for localStorage persistence)

```javascript
// In deserializeCommand function
case 'MERGE_ITEMS':
    return Commands.mergeItems(
        data.targetItemId, 
        data.sourceItemIds, 
        data.mergedContent, 
        data.originalContents
    );
```

**Step 3:** Use the command

```javascript
// In a component
import { Commands } from '../hooks/useCommandHistory';

const handleMerge = () => {
    executeCommand(Commands.mergeItems(
        targetId,
        selectedIds,
        combinedText,
        { [targetId]: originalTargetContent }
    ));
};
```

---

## 5. Adding New Modals

### Overview

Modals are controlled via the `activeModal` state in the UI context.

### Modal Types Registry

**File:** `frontend/src/context/ingestion/constants.js`

```javascript
export const MODAL_TYPES = {
    INGESTION: 'ingestion',
    REGEX: 'regex',
    CACHE_MANAGEMENT: 'cache_management',
    HELPER_FILE_SELECT: 'helper_file_select',
    // Add new modal types here
    FIND_REPLACE: 'find_replace',
    EXPORT_OPTIONS: 'export_options',
};
```

### Adding a New Modal

**Step 1:** Add modal type constant

```javascript
// In constants.js
export const MODAL_TYPES = {
    // ... existing
    MERGE_ITEMS: 'merge_items',
};
```

**Step 2:** Create modal component

**File:** `frontend/src/components/ingestion/MergeItemsModal.jsx`

```jsx
export default function MergeItemsModal({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-lg font-semibold mb-4">Merge Items</h2>
                {/* Modal content */}
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose}>Cancel</button>
                    <button onClick={onConfirm}>Merge</button>
                </div>
            </div>
        </div>
    );
}
```

**Step 3:** Export from index

**File:** `frontend/src/components/ingestion/index.js`

```javascript
export { default as MergeItemsModal } from './MergeItemsModal';
```

**Step 4:** Add to IngestionPage

**File:** `frontend/src/pages/IngestionPage.jsx`

```jsx
import { MergeItemsModal } from '../components/ingestion';

// In render:
<MergeItemsModal
    isOpen={activeModal === MODAL_TYPES.MERGE_ITEMS}
    onClose={handleCloseModal}
    onConfirm={handleMergeConfirm}
/>
```

**Step 5:** Open modal from anywhere

```javascript
// Using actions from context
const actions = useIngestionActions();
actions.openModal(MODAL_TYPES.MERGE_ITEMS);
```

---

## 6. Adding New UI State

### Overview

UI state is managed in the ingestion reducer. To add new state:

### Step 1: Add to Initial State

**File:** `frontend/src/context/ingestion/ingestionReducer.js`

```javascript
export const initialState = {
    // ...existing domains...
    ui: {
        // ...existing state...
        isCompactView: false,      // New state
        selectedTool: 'pointer',   // New state
    },
};
```

### Step 2: Add Action Types

**File:** `frontend/src/context/ingestion/actionTypes.js`

```javascript
// UI Actions
export const COMPACT_VIEW_TOGGLED = 'COMPACT_VIEW_TOGGLED';
export const TOOL_SELECTED = 'TOOL_SELECTED';
```

### Step 3: Add Reducer Cases

**File:** `frontend/src/context/ingestion/ingestionReducer.js`

```javascript
case ActionTypes.COMPACT_VIEW_TOGGLED: {
    return {
        ...state,
        ui: {
            ...state.ui,
            isCompactView: !state.ui.isCompactView,
        },
    };
}

case ActionTypes.TOOL_SELECTED: {
    return {
        ...state,
        ui: {
            ...state.ui,
            selectedTool: action.payload.tool,
        },
    };
}
```

### Step 4: Add Action Creators

**File:** `frontend/src/context/ingestion/hooks.js`

```javascript
// In useIngestionActions hook
toggleCompactView: useCallback(() => {
    dispatch({ type: ActionTypes.COMPACT_VIEW_TOGGLED });
}, [dispatch]),

selectTool: useCallback((tool) => {
    dispatch({ type: ActionTypes.TOOL_SELECTED, payload: { tool } });
}, [dispatch]),
```

### Step 5: Expose in useUI Hook

```javascript
// In hooks.js → useUI
export function useUI() {
    const ui = useContext(UIContext);
    return {
        // ...existing
        isCompactView: ui.isCompactView,
        selectedTool: ui.selectedTool,
    };
}
```

---

## 7. Extending LocalStorage Cache

### Overview

Cache keys are defined in `ingestionConfig.js`. The cache system uses prefixes for per-document storage.

### Cache Key Structure

**File:** `frontend/src/config/ingestionConfig.js`

```javascript
storage: {
    editStateKey: 'ingestion_edit_state',
    documentCacheKey: 'ingestion_document_cache',
    embeddingCachePrefix: 'ingestion_embeddings_',   // + documentId
    ingestedFilesKey: 'ingestion_ingested_files',
    uploadedFilesKey: 'ingestion_uploaded_files',
    contentFilesPrefix: 'ingestion_content_',        // + documentId
    historyPrefix: 'ingestion_history_',             // + documentId
    // Add new keys here
    userPreferencesKey: 'ingestion_preferences',
    exportHistoryKey: 'ingestion_export_history',
},
```

### Adding New Cache Functions

**File:** `frontend/src/utils/fileCacheManager.js`

```javascript
// ==================== USER PREFERENCES ====================

/**
 * Get user preferences for ingestion
 */
export const getUserPreferences = () => {
    return loadFromCache(INGESTION_CONFIG.storage.userPreferencesKey) || {
        defaultStrategy: 'embed_per_page',
        compactView: false,
        autoSave: true,
    };
};

/**
 * Save user preferences
 */
export const saveUserPreferences = (prefs) => {
    saveToCache(INGESTION_CONFIG.storage.userPreferencesKey, prefs);
};

/**
 * Update specific preference
 */
export const updatePreference = (key, value) => {
    const prefs = getUserPreferences();
    prefs[key] = value;
    saveUserPreferences(prefs);
};
```

### Using Cache Hooks

**File:** `frontend/src/hooks/useLocalCache.js`

```javascript
// Available functions:
import { 
    loadFromCache, 
    saveToCache, 
    clearCache, 
    hasCache,
    getKeysWithPrefix 
} from '../hooks/useLocalCache';

// Example usage:
const cached = loadFromCache('my_key');
saveToCache('my_key', { data: 'value' });
clearCache('my_key');
const exists = hasCache('my_key');
const allContentKeys = getKeysWithPrefix('ingestion_content_');
```

---

## 8. Configuration Reference

### Complete Configuration Object

```javascript
// frontend/src/config/ingestionConfig.js

export const INGESTION_CONFIG = {
    // File upload settings
    upload: {
        maxFileSizeMB: 10,
        allowedTypes: ['.pdf'],
        allowedMimeTypes: ['application/pdf'],
        maxConcurrentUploads: 3,
    },

    // Image display settings
    image: {
        maxDisplayWidth: 400,
        maxDisplayHeight: 300,
        thumbnailSize: 150,
    },

    // Undo/redo settings
    history: {
        maxUndoSteps: 50,
    },

    // Helper functions registry
    helpers: {
        local: [...],
        backend: [...],
    },

    // Ingestion strategies registry
    strategies: {
        local: [...],
        backend: [...],
    },

    // Polling intervals
    polling: {
        processingStatusMs: 2000,
        ingestionStatusMs: 3000,
    },

    // Local storage keys
    storage: {
        editStateKey: 'ingestion_edit_state',
        documentCacheKey: 'ingestion_document_cache',
        embeddingCachePrefix: 'ingestion_embeddings_',
        ingestedFilesKey: 'ingestion_ingested_files',
        uploadedFilesKey: 'ingestion_uploaded_files',
        contentFilesPrefix: 'ingestion_content_',
        historyPrefix: 'ingestion_history_',
    },

    // UI settings
    ui: {
        pageNavigationDebounceMs: 100,
        autoSaveDebounceMs: 500,
        toastDurationMs: 3000,
    },
};
```

### Utility Functions

| Function | Purpose |
|----------|---------|
| `getMaxFileSizeBytes()` | Get file size limit in bytes |
| `isValidFileType(file)` | Validate file extension/MIME |
| `isValidFileSize(file)` | Validate file size |
| `getFileSizeLimitText()` | Human-readable size limit |
| `getAllowedTypesText()` | Human-readable allowed types |
| `isLocalStrategy(id)` | Check if strategy is local |
| `isBackendStrategy(id)` | Check if strategy is backend |
| `getEnabledStrategies()` | Get all enabled strategies |
| `getStrategyById(id)` | Get strategy config by ID |

---

## Quick Reference: File Locations

| Feature | Primary File | Supporting Files |
|---------|--------------|------------------|
| File Types | `config/ingestionConfig.js` | `components/ingestion/ConnectedUploadZone.jsx` |
| Helpers | `config/ingestionConfig.js` | `components/ingestion/ConnectedHelperPanel.jsx` |
| Strategies | `config/ingestionConfig.js` | `components/ingestion/IngestionModal.jsx` |
| Commands | `hooks/useCommandHistory.js` | - |
| Modals | `context/ingestion/constants.js` | `components/ingestion/*.jsx` |
| UI State | `context/ingestion/ingestionReducer.js` | `context/ingestion/hooks.js`, `actionTypes.js` |
| Cache | `config/ingestionConfig.js` | `utils/fileCacheManager.js`, `hooks/useLocalCache.js` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ingestionConfig.js                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   upload    │  │   helpers   │  │     strategies      │  │
│  │ allowedTypes│  │local/backend│  │   local/backend     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ConnectedUpload  │ │ConnectedHelper   │ │IngestionModal   │
│Zone.jsx         │ │Panel.jsx         │ │.jsx             │
│                 │ │                  │ │                 │
│ validateFiles() │ │ executeHelper()  │ │INGESTION_       │
│                 │ │ switch(helperId) │ │STRATEGIES       │
└────────┬────────┘ └────────┬─────────┘ └────────┬────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌────────────────────────────────────────────────────────────┐
│                  IngestionPage.jsx                          │
│         (Orchestrates all components and state)             │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│               Context + Reducer (State Management)          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐  │
│  │ fileQueue  │ │  document  │ │  preview   │ │   ui    │  │
│  │  Context   │ │  Context   │ │  Context   │ │ Context │  │
│  └────────────┘ └────────────┘ └────────────┘ └─────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## See Also

- [ADR.md](./ADR.md) - Architectural Decision Records
- [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md) - Component breakdown
- [REDUCER.md](./REDUCER.md) - State management documentation
- [STATE_MACHINE.md](./STATE_MACHINE.md) - State machine diagrams
- [UI_COMPONENTS.md](./UI_COMPONENTS.md) - UI component specifications
