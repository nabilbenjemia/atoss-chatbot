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

*Add more ADRs below as architectural decisions are made.*
