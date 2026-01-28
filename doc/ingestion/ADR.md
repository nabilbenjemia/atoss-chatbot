# Architecture Decision Records (ADR)

This document records key architectural decisions made during the development of the Ingestion Page feature.

---

## ADR-001: Strategy and Helper Code Location

**Date**: 2026-01-28

**Status**: Decided

### Context

The Ingestion Page has two types of processing functions:

1. **Strategies** - How to chunk documents for embedding (e.g., per-page, semantic sections)
2. **Helpers** - Document manipulation functions (e.g., remove logos, AI descriptions)

Each can be either:
- **Local** - Runs in the browser (JavaScript)
- **Backend** - Runs on the server (Python, requires LLM)

### Problem Statement

Where should the code and configuration for strategies/helpers live?

**Requirements**:
1. Allow local execution for instant preview (no network latency)
2. Allow backend execution for AI-powered features
3. Minimize coupling between frontend and backend
4. Support offline editing once page is loaded
5. Easy to add new strategies/helpers

### Options Analyzed

#### Option A: All Static in Frontend

```javascript
// frontend/src/config/ingestionConfig.js
strategies: {
    local: [
        { id: 'embed_per_page', code: function(doc) { ... } },
    ],
    backend: [
        { id: 'semantic_sections', /* no code, calls API */ },
    ]
}
```

| Pros | Cons |
|------|------|
| Simple, no API calls for config | Adding new strategy = frontend deploy |
| TypeScript support, easy debugging | Static coupling |
| Works offline after load | Backend strategies still defined in frontend |

#### Option B: All Dynamic from Backend

```javascript
// Frontend fetches everything from backend
GET /api/strategies → [{ id, label, type, code: "function(doc){...}" }]
GET /api/helpers → [{ id, label, type, code: "function(doc){...}" }]

// Frontend uses eval() or new Function() to execute
```

| Pros | Cons |
|------|------|
| Maximum decoupling | Security risk (eval/Function) |
| Update without frontend deploy | Harder to debug |
| Single source of truth | No TypeScript checking |
| | CSP may block eval |

#### Option C: Hybrid - Metadata from Backend, Code in Frontend

```javascript
// Backend returns METADATA only
GET /api/config → {
    strategies: [
        { id: 'embed_per_page', label: '...', type: 'local', enabled: true },
        { id: 'experimental_v2', label: '...', type: 'local', enabled: false },
        { id: 'semantic_sections', label: '...', type: 'backend', enabled: true },
    ]
}

// Frontend has all LOCAL implementations bundled
const strategyImplementations = {
    'embed_per_page': (doc) => { /* bundled code */ },
    'experimental_v2': (doc) => { /* bundled but hidden */ },
};

// Merge: backend controls visibility, frontend has execution code
```

| Pros | Cons |
|------|------|
| Backend controls which are visible/enabled | New LOCAL strategy = frontend deploy |
| No eval() security risk | Code duplication concern |
| TypeScript/debugging works | |
| Offline execution works | |
| Can A/B test or feature-flag strategies | |

### Decision

**Chosen: Option C - Hybrid Approach**

Backend provides **metadata and control**, frontend provides **local execution code**.

### Rationale

1. **Security**: Avoiding `eval()` or `new Function()` eliminates XSS risks from compromised backend
2. **Developer Experience**: TypeScript checking, source maps, and normal debugging flow
3. **Offline Support**: Once loaded, local strategies work without network
4. **Backend Control**: Backend can enable/disable strategies, add backend-only strategies, without frontend changes
5. **Pragmatic Trade-off**: New LOCAL strategies require frontend deploy, but this is acceptable because:
   - Local strategy = JavaScript code = must be in JS bundle anyway
   - Most new strategies will likely be backend (AI-powered)
   - Local strategies are relatively stable once defined

### Implementation

#### Backend `/api/config` Response

```python
@router.get("/api/config")
async def get_config():
    return {
        "strategies": [
            {"id": "embed_per_page", "label": "One Embedding per Page", "type": "local", "enabled": True},
            {"id": "chunked_fixed", "label": "Fixed-Size Chunks", "type": "local", "enabled": True},
            {"id": "semantic_sections", "label": "Semantic Sections (AI)", "type": "backend", "enabled": True},
            {"id": "hierarchical", "label": "Hierarchical (AI)", "type": "backend", "enabled": False},
        ],
        "helpers": [
            {"id": "remove_logos", "label": "Remove All Logos", "type": "local", "enabled": True},
            {"id": "remove_empty", "label": "Remove Empty Text", "type": "local", "enabled": True},
            {"id": "delete_regex", "label": "Delete by Regex", "type": "local", "enabled": True, "hasInput": True},
            {"id": "ai_image_descriptions", "label": "AI Image Descriptions", "type": "backend", "enabled": True},
        ],
        "collections": [...],  # Always from backend (database state)
        "imageClasses": [...], # Can be configured on backend
    }
```

#### Frontend Strategy Registry

```javascript
// frontend/src/utils/strategyExecutor.js

// Local strategy implementations (bundled in frontend)
const localStrategies = {
    'embed_per_page': (documentState) => {
        return documentState.pages.map(page => {
            const text = page.items
                .filter(i => !i.deleted && i.type === 'text')
                .map(i => i.content)
                .join('\n\n');
            const images = page.items.filter(i => !i.deleted && i.type === 'image');
            return {
                id: `chunk_page_${page.pageNumber}`,
                text,
                metadata: { page: page.pageNumber, source: documentState.filename },
                images,
            };
        }).filter(chunk => chunk.text || chunk.images.length > 0);
    },
    
    'chunked_fixed': (documentState) => {
        // Fixed-size chunking implementation
        // ...
    },
};

// Execute strategy - local or backend
export const executeStrategy = async (strategyId, documentState, backendConfig) => {
    const strategyMeta = backendConfig.strategies.find(s => s.id === strategyId);
    
    if (!strategyMeta || !strategyMeta.enabled) {
        throw new Error(`Strategy ${strategyId} not available`);
    }
    
    if (strategyMeta.type === 'local') {
        const impl = localStrategies[strategyId];
        if (!impl) throw new Error(`Local strategy ${strategyId} not implemented`);
        return { chunks: impl(documentState) };
    } else {
        // Backend strategy - call API
        return await previewEmbeddingsBackend(strategyId, documentState);
    }
};
```

#### Frontend Hook Integration

```javascript
// frontend/src/hooks/useBackendConfig.js
const useBackendConfig = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const backendConfig = await getBackendConfig();
                
                // Filter to only enabled strategies/helpers
                const processedConfig = {
                    ...backendConfig,
                    strategies: backendConfig.strategies.filter(s => s.enabled),
                    helpers: backendConfig.helpers.filter(h => h.enabled),
                };
                
                setConfig(processedConfig);
            } catch (error) {
                console.error('Failed to load config:', error);
                // Fallback to hardcoded defaults for offline resilience
                setConfig(getDefaultConfig());
            } finally {
                setLoading(false);
            }
        };
        
        fetchConfig();
    }, []);

    return { config, loading };
};
```

### Consequences

**Positive**:
- Clear separation: backend owns metadata/control, frontend owns local execution
- Type-safe local strategy development
- Backend can feature-flag without frontend deploys
- Secure (no dynamic code execution)

**Negative**:
- New local strategies require frontend deploy
- Local strategy code must match backend-defined IDs

**Neutral**:
- Team must coordinate when adding new local strategies (backend adds metadata, frontend adds implementation)

### Summary Table

| Component | Source | Can Update Without Deploy |
|-----------|--------|---------------------------|
| Strategy metadata (id, label, enabled) | Backend | ✅ Backend only |
| Local strategy code | Frontend | ❌ Frontend deploy |
| Backend strategy code | Backend | ✅ Backend only |
| Helper metadata | Backend | ✅ Backend only |
| Local helper code | Frontend | ❌ Frontend deploy |
| Backend helper code | Backend | ✅ Backend only |
| Collections list | Backend (DB) | ✅ Dynamic |
| Image classes | Backend | ✅ Backend only |

---

## ADR-002: Component State Management and Communication

**Date**: 2026-01-28

**Status**: Decided

### Context

The Ingestion Page (`IngestionPage.jsx`) has grown to 1163 lines with:
- 25+ state variables in a single component
- 20+ handler functions passed down via props
- Deep prop drilling through 4-5 component levels
- Tight coupling between components

When user actions in one component affect multiple other components, the current approach requires:
1. Callback props bubbling up to parent
2. Parent updating state
3. Props drilling back down to affected children
4. React re-rendering the entire subtree

**Example Problem**: When user clicks "Confirm & Ingest":
- `EmbeddingPreview` component triggers the action
- `DocumentEditor` must exit preview mode → enter read-only mode
- `PendingFileList` must remove the file
- `IngestedFileList` must add the new ingested file
- `ContentViewer` must update to show read-only state

Currently this requires `IngestionPage` to orchestrate all these state changes, making it a "God Class".

### Problem Statement

How should components communicate state changes that affect other components, while maintaining:
1. Separation of concerns (each component has clear responsibility)
2. Traceability (easy to understand what happens when X)
3. Performance (avoid unnecessary re-renders)
4. Testability (components can be tested in isolation)
5. React-native patterns (follow React community best practices)

### Options Analyzed

#### Option A: Keep Prop Drilling (Status Quo)

```jsx
// IngestionPage.jsx (God Class)
const [mode, setMode] = useState('editing');
const [pendingFiles, setPendingFiles] = useState([]);
const [ingestedFiles, setIngestedFiles] = useState([]);

const handleIngestComplete = (file) => {
    setMode('readonly');
    setPendingFiles(prev => prev.filter(f => f.id !== file.id));
    setIngestedFiles(prev => [...prev, file]);
};

// Pass everything down...
<EmbeddingPreview onIngestComplete={handleIngestComplete} />
<PendingFileList files={pendingFiles} />
<IngestedFileList files={ingestedFiles} />
```

| Pros | Cons |
|------|------|
| Simple mental model | God Class anti-pattern |
| Explicit data flow | Props drilling 4-5 levels |
| Easy to trace in debugger | Tight coupling |
| | Adding new reaction = modify parent |
| | Hard to test in isolation |

#### Option B: Single Context (Naive)

```jsx
const IngestionContext = createContext();

<IngestionContext.Provider value={{ state, dispatch }}>
    <EmbeddingPreview />
    <PendingFileList />
</IngestionContext.Provider>

const { mode, setMode } = useContext(IngestionContext);
```

| Pros | Cons |
|------|------|
| Eliminates prop drilling | All consumers re-render on ANY change |
| Centralized state | Poor performance |
| React-native solution | |

#### Option C: Event-Driven / Pub-Sub Pattern

```jsx
// EmbeddingPreview publishes
eventBus.emit('ingestion:complete', { fileId, result });

// Other components subscribe
useEffect(() => {
    return eventBus.on('ingestion:complete', ({ fileId }) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
    });
}, []);
```

| Pros | Cons |
|------|------|
| True separation of concerns | Implicit data flow (harder to trace) |
| Components own their reactions | Not standard React pattern |
| Loose coupling | Risk of "event spaghetti" |
| Easy to add new subscribers | Breaks unidirectional data flow |

#### Option D: Context + Reducer with Split Contexts

```jsx
// Single reducer handles ALL state transitions
function ingestionReducer(state, action) {
    switch (action.type) {
        case 'INGESTION_COMPLETE':
            return {
                ...state,
                fileQueue: { /* updated */ },
                document: { /* updated */ },
                preview: { /* updated */ },
                ui: { /* updated */ },
            };
    }
}

// Split into multiple READ contexts by domain
<DispatchContext.Provider value={dispatch}>
  <FileQueueContext.Provider value={state.fileQueue}>
    <DocumentContext.Provider value={state.document}>
      <PreviewContext.Provider value={state.preview}>
        <UIContext.Provider value={state.ui}>
```

| Pros | Cons |
|------|------|
| Atomic updates (single dispatch) | More boilerplate than Zustand |
| Fine-grained re-renders (by domain) | Reducer can get large |
| Fully traceable (one switch case) | |
| Standard React patterns | |
| No external dependencies | |

#### Option E: Zustand

```jsx
const useIngestionStore = create((set) => ({
    mode: 'editing',
    completeIngestion: (file) => set(state => ({
        mode: 'readonly',
        // ... all changes
    })),
}));

// Fine-grained subscriptions
const mode = useIngestionStore(state => state.mode);
```

| Pros | Cons |
|------|------|
| Simplest syntax | External dependency |
| Built-in selector pattern | Less "React-native" |
| DevTools support | |

### Decision

**Chosen: Option D - Context + Reducer with Split Contexts**

This is React's idiomatic solution that provides:
1. **Traceability** - All state changes visible in one reducer
2. **Atomic updates** - Single dispatch updates multiple domains
3. **Fine-grained re-renders** - Split contexts by domain
4. **No dependencies** - Pure React patterns

### Rationale

#### Why Not Pub/Sub (Option C)?

Initially considered for "component autonomy" - each component owns its reaction logic. However:

1. **Implicit data flow**: Must search all components to find what happens when event X fires
2. **Not React-native**: Breaks unidirectional data flow principle
3. **Debugging difficulty**: Can't trace data flow in React DevTools
4. **Risk of inconsistency**: Each component manages its own state copy

#### Why Context + Reducer Wins

1. **Traceability**: Open reducer → find action type → see ALL changes in one place
   ```javascript
   case 'INGESTION_COMPLETE':
       return {
           ...state,
           fileQueue: { uploadQueue: filtered, ingestedFiles: [..., new] },
           document: { documentState: null },
           preview: { isPreviewMode: false },
           ui: { mode: 'readonly' },
       };
   // ALL effects of "ingestion complete" visible in ONE location
   ```

2. **Atomic Updates**: Single dispatch → single state update → consistent UI
   - Pub/Sub: Each subscriber updates independently (race conditions possible)
   - Reducer: All changes happen in one immutable state transition

3. **Fine-Grained Re-renders with Split Contexts**:
   ```
   dispatch({ type: 'PAGE_CHANGED' })
              │
       ┌──────┴──────┬──────────┬─────────┐
       ▼             ▼          ▼         ▼
   FileQueue     Document    Preview     UI
   changed?      changed?    changed?    changed?
      NO            YES         NO        NO
                     │
                     ▼
                 Re-render
                 only Document
                 consumers
   ```

4. **Standard React**: Familiar to any React developer, works with React DevTools

### Implementation

#### State Structure (Split by Domain)

```javascript
const initialState = {
    // File Queue Domain
    fileQueue: {
        uploadQueue: [],           // [{ documentId, filename, status }]
        ingestedFiles: [],         // [{ documentId, filename, collection }]
        selectedDocumentId: null,
    },
    
    // Document Domain  
    document: {
        documentState: null,       // { filename, pages: [...] }
        currentPage: 1,
        hasUnsavedChanges: false,
    },
    
    // Preview Domain
    preview: {
        isPreviewMode: false,
        isLoadingPreview: false,
        embeddingPreview: null,
        previewConfig: null,
    },
    
    // UI Domain
    ui: {
        mode: 'editing',           // 'editing' | 'preview' | 'readonly'
        leftSidebarCollapsed: false,
        rightSidebarCollapsed: false,
        isIngesting: false,
    },
};
```

#### Action Types

```javascript
export const ActionTypes = {
    // File lifecycle
    FILE_ADDED: 'FILE_ADDED',
    FILE_SELECTED: 'FILE_SELECTED',
    FILE_DELETED: 'FILE_DELETED',
    
    // Document operations
    DOCUMENT_SET: 'DOCUMENT_SET',
    DOCUMENT_MODIFIED: 'DOCUMENT_MODIFIED',
    PAGE_CHANGED: 'PAGE_CHANGED',
    ITEM_DELETED: 'ITEM_DELETED',
    ITEM_RESTORED: 'ITEM_RESTORED',
    
    // Preview & Ingestion
    PREVIEW_STARTED: 'PREVIEW_STARTED',
    PREVIEW_GENERATED: 'PREVIEW_GENERATED',
    PREVIEW_CANCELLED: 'PREVIEW_CANCELLED',
    INGESTION_COMPLETE: 'INGESTION_COMPLETE',
    
    // UI
    MODE_CHANGED: 'MODE_CHANGED',
    SIDEBAR_TOGGLED: 'SIDEBAR_TOGGLED',
};
```

#### Reducer (Cross-Domain Actions)

```javascript
function ingestionReducer(state, action) {
    switch (action.type) {
        // Cross-domain action: affects multiple domains atomically
        case ActionTypes.INGESTION_COMPLETE: {
            const { documentId, filename, collection, chunkCount } = action.payload;
            return {
                ...state,
                // Update File Queue domain
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.filter(
                        f => f.documentId !== documentId
                    ),
                    ingestedFiles: [
                        ...state.fileQueue.ingestedFiles, 
                        { documentId, filename, collection, chunkCount }
                    ],
                    selectedDocumentId: null,
                },
                // Update Document domain
                document: {
                    ...state.document,
                    documentState: null,
                    hasUnsavedChanges: false,
                },
                // Update Preview domain
                preview: {
                    ...state.preview,
                    isPreviewMode: false,
                    embeddingPreview: null,
                    previewConfig: null,
                },
                // Update UI domain
                ui: {
                    ...state.ui,
                    mode: 'readonly',
                    isIngesting: false,
                },
            };
        }
        
        // Single-domain action: only affects one domain
        case ActionTypes.PAGE_CHANGED:
            return {
                ...state,
                document: {
                    ...state.document,
                    currentPage: action.payload.page,
                },
            };
            
        // ... other cases
    }
}
```

#### Split Contexts Provider

```javascript
// Contexts - one per domain + dispatch
const FileQueueContext = createContext(null);
const DocumentContext = createContext(null);
const PreviewContext = createContext(null);
const UIContext = createContext(null);
const DispatchContext = createContext(null);  // Stable, never causes re-renders

export function IngestionProvider({ children }) {
    const [state, dispatch] = useReducer(ingestionReducer, initialState);
    
    // Each domain gets its own context
    // React compares by reference - if fileQueue object didn't change,
    // FileQueueContext consumers won't re-render
    
    return (
        <DispatchContext.Provider value={dispatch}>
            <FileQueueContext.Provider value={state.fileQueue}>
                <DocumentContext.Provider value={state.document}>
                    <PreviewContext.Provider value={state.preview}>
                        <UIContext.Provider value={state.ui}>
                            {children}
                        </UIContext.Provider>
                    </PreviewContext.Provider>
                </DocumentContext.Provider>
            </FileQueueContext.Provider>
        </DispatchContext.Provider>
    );
}
```

#### Hooks

```javascript
// Domain-specific state hooks
export const useFileQueue = () => useContext(FileQueueContext);
export const useDocument = () => useContext(DocumentContext);
export const usePreview = () => useContext(PreviewContext);
export const useUI = () => useContext(UIContext);

// Dispatch hook - stable reference, never causes re-renders
export const useDispatch = () => useContext(DispatchContext);

// Action creators for cleaner component code
export function useIngestionActions() {
    const dispatch = useDispatch();
    
    return useMemo(() => ({
        selectFile: (documentId) => dispatch({ 
            type: ActionTypes.FILE_SELECTED, 
            payload: { documentId } 
        }),
        changePage: (page) => dispatch({ 
            type: ActionTypes.PAGE_CHANGED, 
            payload: { page } 
        }),
        completeIngestion: (result) => dispatch({ 
            type: ActionTypes.INGESTION_COMPLETE, 
            payload: result 
        }),
        // ... other actions
    }), [dispatch]);
}
```

#### Component Usage Examples

**Read-only component** (minimal re-renders):
```jsx
function ModeIndicator() {
    // ✅ Only re-renders when ui.mode changes
    const { mode } = useUI();
    return <Badge>{mode}</Badge>;
}
```

**Write-only component** (NEVER re-renders from state):
```jsx
function SaveButton() {
    // ✅ dispatch is stable, component never re-renders
    const dispatch = useDispatch();
    return (
        <button onClick={() => dispatch({ type: 'DOCUMENT_SAVED' })}>
            Save
        </button>
    );
}
```

**Using action creators** (cleaner syntax):
```jsx
function IngestButton() {
    const actions = useIngestionActions();
    const { isIngesting } = useUI();
    
    const handleClick = async () => {
        const result = await ingestToVectorDB();
        actions.completeIngestion(result);
    };
    
    return (
        <button disabled={isIngesting} onClick={handleClick}>
            {isIngesting ? 'Ingesting...' : 'Confirm & Ingest'}
        </button>
    );
}
```

**Cross-domain component** (subscribes to multiple domains):
```jsx
function DocumentEditor() {
    const { documentState, currentPage } = useDocument();
    const { mode } = useUI();
    const actions = useIngestionActions();
    
    // Re-renders when document OR ui changes
    // Does NOT re-render when fileQueue or preview changes
    
    const isReadOnly = mode === 'readonly' || mode === 'preview';
    
    return (
        <div className={isReadOnly ? 'opacity-50' : ''}>
            <PageContent page={currentPage} readOnly={isReadOnly} />
        </div>
    );
}
```

### Flow Diagram

```
User clicks "Confirm & Ingest"
            │
            ▼
    ┌───────────────────────────────────┐
    │  EmbeddingPreview                 │
    │  dispatch({                       │
    │    type: 'INGESTION_COMPLETE',    │
    │    payload: { fileId, ... }       │
    │  })                               │
    └───────────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────────┐
    │  Reducer                          │
    │  case INGESTION_COMPLETE:         │
    │    return {                       │
    │      fileQueue: { updated },      │
    │      document: { cleared },       │
    │      preview: { closed },         │
    │      ui: { mode: readonly },      │
    │    }                              │
    └───────────────────────────────────┘
            │
    React compares each context value by reference:
            │
    ┌───────┼───────┬───────┬───────┐
    ▼       ▼       ▼       ▼       ▼
FileQueue Document Preview   UI   Dispatch
 changed   changed  changed changed stable
   YES       YES      YES     YES    NO
    │         │        │       │
    ▼         ▼        ▼       ▼
 Re-render Re-render Re-render Re-render
 FileQueue Document  Preview   UI
 consumers consumers consumers consumers
```

### Consequences

**Positive**:
- All state transitions visible in one reducer (traceability)
- Atomic updates across domains (consistency)
- Fine-grained re-renders via split contexts (performance)
- Standard React patterns (familiar to team)
- Works with React DevTools (debugging)
- No external dependencies

**Negative**:
- Reducer can become large (mitigate: extract domain sub-reducers)
- More boilerplate than Zustand
- Must be disciplined about which context to subscribe to

### Migration Path

1. **Phase 1**: Create `IngestionContext.jsx` with reducer and split providers
2. **Phase 2**: Wrap `IngestionPage` with `<IngestionProvider>`
3. **Phase 3**: Migrate state from `IngestionPage` to context, one domain at a time
4. **Phase 4**: Replace prop drilling with hooks (`useDocument()`, `useDispatch()`, etc.)
5. **Phase 5**: `IngestionPage` becomes layout-only component

### Alternative Considered: Zustand

If boilerplate becomes burdensome, Zustand is a viable alternative:

```javascript
const useIngestionStore = create((set) => ({
    // State
    fileQueue: { uploadQueue: [], ingestedFiles: [] },
    document: { documentState: null, currentPage: 1 },
    ui: { mode: 'editing' },
    
    // Actions
    completeIngestion: (result) => set(state => ({
        fileQueue: { /* updated */ },
        document: { documentState: null },
        ui: { mode: 'readonly' },
    })),
}));

// Usage with selector (fine-grained subscriptions)
const mode = useIngestionStore(state => state.ui.mode);
const completeIngestion = useIngestionStore(state => state.completeIngestion);
```

Zustand provides the same benefits with less code, but adds an external dependency.

---

*Add more ADRs below as architectural decisions are made.*
