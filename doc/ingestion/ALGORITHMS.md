# Ingestion Page - Algorithms & Complex Code Patterns

This document explains the non-obvious algorithms and code patterns used in the Ingestion Page feature.

---

## Table of Contents
1. [AI Image Description Helper](#ai-image-description-helper)
2. [Command Pattern (Undo/Redo)](#command-pattern-undoredo)

---

## AI Image Description Helper

**Location**: `frontend/src/pages/IngestionPage.jsx` (lines ~484-514)

### What It Does

This code handles the flow when a user clicks "Generate Image Descriptions (AI)" helper. It:
1. Sends all document content to the backend LLM service
2. Receives AI-generated descriptions for each image
3. Updates the local document state with these descriptions
4. Makes the changes undoable

### Step-by-Step Explanation

```javascript
case 'ai_image_descriptions': {
    // 1. CALL BACKEND
    // Send the entire documentState to the LLM service
    // The backend will:
    //   - Extract all images from the document
    //   - Send each image to an AI model (e.g., Ollama vision model)
    //   - Return descriptions for each image
    const result = await runBackendHelper(helperId, documentState, {});
    
    // 2. CHECK RESPONSE
    // Backend returns: { success: true, modifiedItems: [{id: "item_123", description: "A bar chart showing..."}] }
    if (result.success && result.modifiedItems) {
        
        // 3. BUILD UNDO/REDO CHANGES
        // For each item the backend modified, we need to:
        //   - Find what the OLD description was (for undo)
        //   - Store the NEW description (for redo)
        const changes = result.modifiedItems
            .filter(m => m.description)  // Only items that got descriptions
            .map(m => {
                // Find the old description by searching through all pages/items
                let oldDescription = '';
                for (const page of documentState.pages) {
                    const item = page.items.find(i => i.id === m.id);
                    if (item) {
                        oldDescription = item.description || '';
                        break;
                    }
                }
                
                // Return a change object for the Command Pattern
                return {
                    itemId: m.id,
                    newValues: { description: m.description },  // What to set on execute/redo
                    oldValues: { description: oldDescription }, // What to set on undo
                };
            });

        // 4. EXECUTE AS BATCH COMMAND
        // This applies all changes at once AND makes them undoable as a single action
        // User presses Ctrl+Z → ALL descriptions are removed at once
        if (changes.length > 0) {
            executeCommand(Commands.batchUpdate(changes));
            setHasUnsavedChanges(true);  // Show "unsaved" indicator
        }
        
        message = result.message || 'AI descriptions generated';
    }
    break;
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  documentState (before)                                                  │
│  {                                                                       │
│    pages: [                                                              │
│      { items: [                                                          │
│        { id: "img_1", type: "image", imageUrl: "...", description: "" }, │
│        { id: "img_2", type: "image", imageUrl: "...", description: "" }, │
│      ]}                                                                  │
│    ]                                                                     │
│  }                                                                       │
│         │                                                                │
│         ▼                                                                │
│  runBackendHelper("ai_image_descriptions", documentState)                │
│         │                                                                │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend (LLM Service)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Extract images from documentState                                    │
│  2. For each image:                                                      │
│     - Decode base64 or fetch URL                                         │
│     - Send to vision model: "Describe this image"                        │
│     - Collect response                                                   │
│  3. Return: { success: true, modifiedItems: [...] }                      │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  result.modifiedItems:                                                   │
│  [                                                                       │
│    { id: "img_1", description: "A bar chart showing Q1 revenue..." },    │
│    { id: "img_2", description: "Company logo with blue background" },    │
│  ]                                                                       │
│         │                                                                │
│         ▼                                                                │
│  Build changes array (for undo/redo):                                    │
│  [                                                                       │
│    { itemId: "img_1", newValues: {description: "A bar..."}, oldValues: {description: ""} },
│    { itemId: "img_2", newValues: {description: "Company..."}, oldValues: {description: ""} },
│  ]                                                                       │
│         │                                                                │
│         ▼                                                                │
│  executeCommand(Commands.batchUpdate(changes))                           │
│         │                                                                │
│         ▼                                                                │
│  documentState (after)                                                   │
│  {                                                                       │
│    pages: [                                                              │
│      { items: [                                                          │
│        { id: "img_1", ..., description: "A bar chart showing Q1..." },   │
│        { id: "img_2", ..., description: "Company logo with blue..." },   │
│      ]}                                                                  │
│    ]                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Store Old Values?

The `oldValues` are needed for the **Command Pattern** undo/redo system:

| Action | What Happens |
|--------|--------------|
| **Execute** | Set `item.description = newValues.description` |
| **Undo** | Set `item.description = oldValues.description` |
| **Redo** | Set `item.description = newValues.description` |

Without storing old values, we couldn't undo the AI descriptions.

### Why Batch Update?

Using `Commands.batchUpdate(changes)` instead of individual updates means:
- ✅ **Single undo** - Ctrl+Z removes ALL descriptions at once
- ✅ **Atomic operation** - Either all succeed or all fail
- ✅ **Performance** - One state update instead of N updates

---

## Command Pattern (Undo/Redo)

**Location**: `frontend/src/hooks/useCommandHistory.js`

### Overview

The Command Pattern is used to make all document edits undoable. Instead of directly modifying state, we create "command" objects that know how to:
1. **Execute** - Apply the change
2. **Undo** - Reverse the change

### How It Works

```javascript
// Instead of this (not undoable):
setDocumentState(prev => ({
  ...prev,
  pages: prev.pages.map(p => ({
    ...p,
    items: p.items.map(i => 
      i.id === itemId ? { ...i, deleted: true } : i
    )
  }))
}));

// We do this (undoable):
executeCommand(Commands.deleteItem(itemId));
```

### Command Types

| Command | Execute | Undo |
|---------|---------|------|
| `deleteItem(id)` | Set `item.deleted = true` | Set `item.deleted = false` |
| `restoreItem(id)` | Set `item.deleted = false` | Set `item.deleted = true` |
| `editItem(id, new, old)` | Set `item.content = new` | Set `item.content = old` |
| `batchDelete([ids])` | Set all `deleted = true` | Set all `deleted = false` |
| `batchUpdate([changes])` | Apply all newValues | Apply all oldValues |
| `renameDocument(new, old)` | Set `filename = new` | Set `filename = old` |

### Memory Efficiency

The command pattern is memory-efficient because:
- We only store **deltas** (changes), not full document snapshots
- A delete command is just `{ type: 'delete', itemId: 'xxx' }` (~50 bytes)
- vs. storing entire documentState on each change (~100KB+)

---

## Commands.batchUpdate() Deep Dive

**Location**: `frontend/src/hooks/useCommandHistory.js` (lines ~95-110)

### The Function

```javascript
batchUpdate: (changes) => ({
    // changes: [{ itemId, newValues: {...}, oldValues: {...} }, ...]
    type: 'BATCH_UPDATE',
    changes,
    execute: (doc) => {
        let result = doc;
        for (const { itemId, newValues } of changes) {
            result = applyToItem(result, itemId, (item) => ({ ...item, ...newValues }));
        }
        return result;
    },
    undo: (doc) => {
        let result = doc;
        for (const { itemId, oldValues } of changes) {
            result = applyToItem(result, itemId, (item) => ({ ...item, ...oldValues }));
        }
        return result;
    },
}),
```

### What It Does

`batchUpdate` is a **command factory** that creates a command object capable of:
1. **Executing** - Applying multiple item updates at once
2. **Undoing** - Reverting all updates at once

### Input: The `changes` Array

```javascript
const changes = [
    { 
        itemId: "img_1", 
        newValues: { description: "A chart showing revenue" },  // What to set
        oldValues: { description: "" }                          // What it was before
    },
    { 
        itemId: "img_2", 
        newValues: { description: "Company logo" }, 
        oldValues: { description: "" } 
    },
];
```

### Output: A Command Object

```javascript
{
    type: 'BATCH_UPDATE',
    changes: [...],           // Stored for reference
    execute: (doc) => {...},  // Function to apply changes
    undo: (doc) => {...},     // Function to revert changes
}
```

### Execute Flow (Forward)

```
Initial State:
doc.pages[0].items = [
    { id: "img_1", description: "" },
    { id: "img_2", description: "" },
]

Loop iteration 1 (itemId: "img_1"):
  result = applyToItem(doc, "img_1", item => ({ ...item, description: "A chart..." }))
  
Loop iteration 2 (itemId: "img_2"):
  result = applyToItem(result, "img_2", item => ({ ...item, description: "Company logo" }))

Final State:
doc.pages[0].items = [
    { id: "img_1", description: "A chart showing revenue" },
    { id: "img_2", description: "Company logo" },
]
```

### Undo Flow (Backward)

```
Current State:
doc.pages[0].items = [
    { id: "img_1", description: "A chart showing revenue" },
    { id: "img_2", description: "Company logo" },
]

Loop iteration 1 (itemId: "img_1"):
  result = applyToItem(doc, "img_1", item => ({ ...item, description: "" }))
  
Loop iteration 2 (itemId: "img_2"):
  result = applyToItem(result, "img_2", item => ({ ...item, description: "" }))

Final State (back to original):
doc.pages[0].items = [
    { id: "img_1", description: "" },
    { id: "img_2", description: "" },
]
```

---

## applyToItem() - The Core Update Function

**Location**: `frontend/src/hooks/useCommandHistory.js` (lines ~115-130)

### The Function

```javascript
function applyToItem(doc, itemId, transform) {
    if (!doc?.pages) return doc;

    return {
        ...doc,
        pages: doc.pages.map((page) => {
            // Check if this page contains the item
            const hasItem = page.items?.some((item) => item.id === itemId);
            if (!hasItem) return page; // Structural sharing - same reference

            return {
                ...page,
                items: page.items.map((item) =>
                    item.id === itemId ? transform(item) : item
                ),
            };
        }),
    };
}
```

### What It Does

`applyToItem` is a **pure function** that:
1. Takes a document state
2. Finds an item by ID
3. Applies a transformation to that item
4. Returns a NEW document state (immutability)

### Key Concept: Structural Sharing

This is the clever optimization that makes the command pattern efficient:

```
BEFORE:
doc ──► { pages: [ page0, page1, page2 ] }
                    │       │       │
                    ▼       ▼       ▼
                 [items] [items] [items]

AFTER applyToItem(doc, "item_in_page1", transform):
newDoc ──► { pages: [ page0, NEW_page1, page2 ] }
                      │         │         │
                      │         ▼         │
                      │      [NEW_items]  │
                      │                   │
                      └─── SAME REFERENCE ┘
```

**Only the changed path is recreated** - pages that don't contain the item keep the same reference.

### Why This Matters

| Approach | Memory Usage | Performance |
|----------|--------------|-------------|
| Deep clone entire doc | O(n) - copies everything | Slow for large docs |
| Structural sharing | O(log n) - only changed path | Fast, minimal allocations |

### Step-by-Step Execution

```javascript
// Given:
const doc = {
    filename: "report.pdf",
    pages: [
        { pageNumber: 1, items: [{ id: "txt_1", content: "Hello" }] },
        { pageNumber: 2, items: [{ id: "img_1", description: "" }] },
    ]
};

// Call:
applyToItem(doc, "img_1", item => ({ ...item, description: "A chart" }))

// Execution:
// 1. Check doc.pages exists ✓
// 2. Return new object with spread: { ...doc, pages: [...] }
// 3. Map over pages:
//    - Page 1: hasItem = false → return SAME page object (no copy)
//    - Page 2: hasItem = true → return NEW page object with transformed item
// 4. Result:

{
    filename: "report.pdf",  // Same string reference
    pages: [
        { pageNumber: 1, items: [...] },  // SAME object reference as before
        { pageNumber: 2, items: [{ id: "img_1", description: "A chart" }] },  // NEW object
    ]
}
```

### Why Not Just Mutate?

React requires immutability for change detection:

```javascript
// ❌ BAD - React won't re-render
doc.pages[1].items[0].description = "A chart";
setDoc(doc);  // Same reference, React thinks nothing changed

// ✅ GOOD - React detects change
const newDoc = applyToItem(doc, "img_1", item => ({ ...item, description: "A chart" }));
setDoc(newDoc);  // New reference, React re-renders
```

---

*Add more algorithm explanations below as needed.*
