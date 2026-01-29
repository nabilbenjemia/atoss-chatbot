# Ingestion Page - Algorithms & Complex Code Patterns

This document explains the non-obvious algorithms and code patterns used in the Ingestion Page feature.

---

## Table of Contents
1. [AI Image Description Helper](#ai-image-description-helper)
2. [Command Pattern (Undo/Redo)](#command-pattern-undoredo)

---

## AI Image Description Helper

**Location**: `frontend/src/components/ingestion/connected/ConnectedHelperPanel.jsx`

### What It Does

This code handles the flow when a user clicks "Generate Image Descriptions (AI)" helper. It:
1. Collects all non-deleted images from the document with their URLs and metadata
2. Sends the documentId and images array to the backend
3. Receives AI-generated descriptions for each image
4. **Inserts a new TextItem** right below each image containing the description
5. Makes the changes undoable as a single action

### Step-by-Step Explanation

```javascript
case 'ai_image_descriptions': {
    // 1. COLLECT IMAGES
    // Gather all non-deleted images from all pages
    const images = [];
    for (const page of documentState.pages) {
        for (const item of page.items) {
            if (item.type === 'image' && !item.deleted) {
                images.push({
                    id: item.id,
                    imageUrl: item.imageUrl,
                    classification: item.classification || 'unclassified',
                    pageNumber: page.pageNumber,
                });
            }
        }
    }

    if (images.length === 0) {
        message = 'No images found in document';
        break;
    }

    // 2. CALL BACKEND
    // Send documentId and images array to the backend
    // Backend returns: { success: true, descriptions: [{imageId, description}] }
    const result = await generateImageDescriptions(
        documentState.documentId,
        images
    );

    // 3. CHECK RESPONSE AND BUILD INSERTIONS
    if (result.success && result.descriptions) {
        // Create insertions: new text items after each image
        const insertions = result.descriptions
            .filter(d => d.description)
            .map(d => ({
                afterItemId: d.imageId,  // Insert after this image
                newItem: {
                    id: `desc_${d.imageId}_${Date.now()}`,
                    type: 'text',
                    content: `**Image Description:** ${d.description}`,
                    deleted: false,
                },
            }));

        // 4. EXECUTE AS BATCH INSERT COMMAND
        // This inserts all text items at once AND makes them undoable
        // User presses Ctrl+Z → ALL description items are removed at once
        if (insertions.length > 0) {
            executeCommand(Commands.batchInsertAfter(insertions));
        }
        message = result.message || `Generated descriptions for ${insertions.length} image(s)`;
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
│    documentId: "doc_123",                                                │
│    pages: [                                                              │
│      { pageNumber: 1, items: [                                           │
│        { id: "img_1", type: "image", imageUrl: "...", classification: "chart" },
│        { id: "txt_1", type: "text", content: "..." },                    │
│        { id: "img_2", type: "image", imageUrl: "...", classification: "logo" },
│      ]}                                                                  │
│    ]                                                                     │
│  }                                                                       │
│         │                                                                │
│         ▼                                                                │
│  Collect images: [{id: "img_1", imageUrl, classification, pageNumber},  │
│                   {id: "img_2", imageUrl, classification, pageNumber}]   │
│         │                                                                │
│         ▼                                                                │
│  generateImageDescriptions(documentId, images)                           │
│         │                                                                │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend (Ingestion Service)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  POST /api/ingestion/helper/image-descriptions                           │
│  Request: { documentId, images: [{id, imageUrl, classification, pageNumber}] }
│                                                                          │
│  1. For each image:                                                      │
│     - Get classification-specific prompt (see table below)               │
│     - Process image (decode base64 or fetch URL)                         │
│     - Send to AI/LLM with classification hint                            │
│     - Collect response                                                   │
│  2. Return: { success: true, descriptions: [{imageId, classification, description}] }
│                                                                          │
│  Classification-Aware Prompts:                                           │
│  ┌──────────────┬────────────────────────────────────────────────────┐  │
│  │ logo         │ "This appears to be a company or brand logo."      │  │
│  │ chart        │ "This is a chart or graph presenting data..."      │  │
│  │ diagram      │ "This is a diagram illustrating a process..."      │  │
│  │ figure       │ "This is a figure or illustration..."              │  │
│  │ photo        │ "This is a photograph capturing a real-world..."   │  │
│  │ screenshot   │ "This is a screenshot showing a user interface..." │  │
│  │ table_image  │ "This is an image of a table..."                   │  │
│  │ other        │ "This is a visual element..."                      │  │
│  └──────────────┴────────────────────────────────────────────────────┘  │
│                                                                          │
│  NOTE: Currently returns MOCK data. LLM integration pending.             │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  result.descriptions:                                                    │
│  [                                                                       │
│    { imageId: "img_1", description: "A bar chart showing Q1 revenue..." },
│    { imageId: "img_2", description: "Company logo with blue background" },
│  ]                                                                       │
│         │                                                                │
│         ▼                                                                │
│  Build insertions array:                                                 │
│  [                                                                       │
│    { afterItemId: "img_1", newItem: {id: "desc_img_1_...", type: "text", content: "**Image Description:** A bar..."} },
│    { afterItemId: "img_2", newItem: {id: "desc_img_2_...", type: "text", content: "**Image Description:** Company..."} },
│  ]                                                                       │
│         │                                                                │
│         ▼                                                                │
│  executeCommand(Commands.batchInsertAfter(insertions))                   │
│         │                                                                │
│         ▼                                                                │
│  documentState (after)                                                   │
│  {                                                                       │
│    pages: [                                                              │
│      { pageNumber: 1, items: [                                           │
│        { id: "img_1", type: "image", ... },                              │
│        { id: "desc_img_1_...", type: "text", content: "**Image Description:** A bar chart..." }, ← NEW
│        { id: "txt_1", type: "text", content: "..." },                    │
│        { id: "img_2", type: "image", ... },                              │
│        { id: "desc_img_2_...", type: "text", content: "**Image Description:** Company logo..." }, ← NEW
│      ]}                                                                  │
│    ]                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

```javascript
// batchInsertAfter command (in useCommandHistory.js)
batchInsertAfter: (insertions) => ({
    // insertions: [{ afterItemId, newItem }, ...]
    type: 'BATCH_INSERT_AFTER',
    insertions,
    execute: (doc) => insertItemsAfter(doc, insertions),
    undo: (doc) => removeInsertedItems(doc, insertions.map(i => i.newItem.id)),
})

// Helper: Insert items after specific target items
function insertItemsAfter(doc, insertions) {
    const insertionMap = new Map();
    for (const { afterItemId, newItem } of insertions) {
        insertionMap.set(afterItemId, newItem);
    }

    return {
        ...doc,
        pages: doc.pages.map((page) => {
            const hasAnyTarget = page.items?.some((item) => insertionMap.has(item.id));
            if (!hasAnyTarget) return page;

            const newItems = [];
            for (const item of page.items) {
                newItems.push(item);
                if (insertionMap.has(item.id)) {
                    newItems.push(insertionMap.get(item.id));  // Insert after
                }
            }
            return { ...page, items: newItems };
        }),
    };
}
```

| Action | What Happens |
|--------|--------------|
| **Execute** | Insert new TextItem after each ImageItem |
| **Undo** | Remove all inserted TextItems by their IDs |
| **Redo** | Re-insert the TextItems in the same positions |

### Why Insert Instead of Update?

The new approach inserts **separate TextItems** instead of updating the image's description field:
- ✅ **Visible content** - Description appears as editable text below the image
- ✅ **User can edit** - The generated description can be manually refined
- ✅ **Markdown support** - Content is rendered with markdown formatting
- ✅ **Independent deletion** - Description can be deleted without affecting the image

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
| `batchInsertAfter([insertions])` | Insert items after targets | Remove inserted items |
| `renameDocument(new, old)` | Set `filename = new` | Set `filename = old` |

### Memory Efficiency

The command pattern is memory-efficient because:
- We only store **deltas** (changes), not full document snapshots
- A delete command is just `{ type: 'delete', itemId: 'xxx' }` (~50 bytes)
- vs. storing entire documentState on each change (~100KB+)

---

## Commands.batchUpdate() Deep Dive

**Location**: `frontend/src/hooks/useCommandHistory.js`

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
