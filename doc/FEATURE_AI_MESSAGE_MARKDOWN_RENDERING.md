# Feature: AI Message Markdown Rendering with Image Support

This document describes the implementation of markdown parsing and rendering in AI chat messages, including support for images referenced by UUID from the database.

---

## Overview

The AI chatbox needs to:
1. **Parse markdown** returned by the LLM (headings, code blocks, lists, tables, etc.)
2. **Render markdown** elements with proper styling
3. **Handle image UUIDs** - when the LLM returns an image UUID, fetch and display the image
4. **Support streaming** - re-render as tokens arrive, detecting block types dynamically

---

## 1️⃣ Current Implementation

### Markdown Parsing (AIMessage.jsx)

Currently uses **`react-markdown`** with **`remarkGfm`** plugin:

```jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
    {message}
</ReactMarkdown>
```

### Supported Elements

| Markdown Syntax | Rendered As | Tailwind Styling |
|-----------------|-------------|------------------|
| `#`, `##`, `###` | Headings | `prose-headings:font-semibold` |
| ```` ``` ```` | Code blocks | `prose-pre:bg-gray-800 prose-pre:text-gray-100` |
| `` `code` `` | Inline code | `prose-code:bg-gray-300 prose-code:px-1` |
| `-`, `*`, `1.` | Lists | `prose-ul:my-2 prose-ol:my-2` |
| `\|---\|` | Tables (GFM) | Default prose styling |
| `**bold**` | Bold | `prose-strong:text-gray-900` |
| `> quote` | Blockquotes | `prose-blockquote:border-l-4 prose-blockquote:border-blue-400` |
| `![alt](url)` | Images | **Not yet implemented with UUID support** |

### Current Limitation

Images only work with direct URLs:
```markdown
![Screenshot](https://example.com/image.png)  ✅ Works
![Screenshot](img:550e8400-e29b-41d4-a716-446655440000)  ❌ Won't load
```

---

## 2️⃣ Feature: Image UUID Support

### Problem

The LLM may reference images stored in our database using UUIDs:
```markdown
Here is the screenshot you requested:

![Staff Center Menu](img:550e8400-e29b-41d4-a716-446655440000)

As you can see in the image above...
```

The frontend must:
1. **Detect** image references with UUID pattern
2. **Fetch** the image from backend API
3. **Display** the image (with loading state)
4. **Handle errors** gracefully

### Image Reference Format

```
![alt text](img:<uuid>)
```

Example:
```
![Staff Center Screenshot](img:550e8400-e29b-41d4-a716-446655440000)
```

---

## 3️⃣ Architecture

### Data Flow with Images

```
┌──────────────┐      ┌───────────────────┐      ┌─────────────────────┐
│   Frontend   │      │   Node.js (4004)  │      │   FastAPI (8000)    │
│  AIMessage   │      │   Image Service   │      │   Image Storage     │
└──────┬───────┘      └─────────┬─────────┘      └──────────┬──────────┘
       │                        │                           │
       │ 1. Receive token:      │                           │
       │    "![alt](img:uuid)"  │                           │
       │                        │                           │
       │ 2. ReactMarkdown       │                           │
       │    detects image       │                           │
       │                        │                           │
       │ 3. Custom renderer     │                           │
       │    extracts UUID       │                           │
       │                        │                           │
       │ 4. GET /api/images/:uuid                           │
       │───────────────────────>│                           │
       │                        │                           │
       │                        │ 5. Fetch from storage     │
       │                        │──────────────────────────>│
       │                        │                           │
       │                        │<──────────────────────────│
       │                        │ 6. Image data (base64/URL)│
       │                        │                           │
       │ 7. Image blob/URL      │                           │
       │<───────────────────────│                           │
       │                        │                           │
       │ 8. Render <img>        │                           │
       │                        │                           │
```

### Streaming with Images

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STREAMING + IMAGE RENDERING                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Token Stream:                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ "Here" → "is" → "the" → "screenshot:" → "\n\n" → "![" → "alt" →     │   │
│  │ "](img:" → "550e8400" → "-e29b-..." → ")" → "\n\n" → "As" → ...     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Accumulated State at each re-render:                                        │
│                                                                              │
│  Step 1: "Here is the screenshot:"                                           │
│          → Renders as paragraph                                              │
│                                                                              │
│  Step 2: "Here is the screenshot:\n\n!["                                     │
│          → Partial image syntax, renders as text                             │
│                                                                              │
│  Step 3: "Here is the screenshot:\n\n![alt](img:550e8400-e29b-..."          │
│          → Still incomplete, renders as text                                 │
│                                                                              │
│  Step 4: "Here is the screenshot:\n\n![alt](img:550e8400-e29b-41d4-...)"    │
│          → COMPLETE! ReactMarkdown detects image                             │
│          → Custom renderer triggers fetch for UUID                           │
│          → Shows loading placeholder                                         │
│                                                                              │
│  Step 5: Image loaded                                                        │
│          → Replace placeholder with actual image                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ Implementation Plan

### Frontend Changes

#### File: `frontend/src/components/AIMessage.jsx`

```jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';

// Custom image component to handle UUID references
const ImageRenderer = ({ src, alt }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if src is a UUID reference
        if (src?.startsWith('img:')) {
            const uuid = src.replace('img:', '');
            setLoading(true);
            setError(null);
            
            // Fetch image from backend
            fetch(`http://localhost:4004/api/images/${uuid}`)
                .then(res => {
                    if (!res.ok) throw new Error('Image not found');
                    return res.json();
                })
                .then(data => {
                    // data.url or data.base64
                    setImageSrc(data.url || `data:image/png;base64,${data.base64}`);
                })
                .catch(err => {
                    setError(err.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            // Regular URL, use directly
            setImageSrc(src);
        }
    }, [src]);

    if (loading) {
        return (
            <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 my-2">
                <svg className="animate-spin h-6 w-6 text-gray-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Loading image...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2 text-sm text-red-600">
                ⚠️ Failed to load image: {error}
            </div>
        );
    }

    return (
        <img 
            src={imageSrc} 
            alt={alt} 
            className="max-w-full h-auto rounded-lg my-2 shadow-sm"
            loading="lazy"
        />
    );
};

export default function AIMessage({ message, createdAt, isStreaming }) {
    return (
        <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[70%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-2xl break-words prose prose-sm prose-gray max-w-none ...">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            // Custom image renderer
                            img: ImageRenderer,
                            // Custom code block with copy button
                            code: CodeRenderer,
                        }}
                    >
                        {message}
                    </ReactMarkdown>
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-1 bg-gray-500 animate-pulse" />
                    )}
                </div>
            </div>
        </div>
    );
}
```

#### File: `frontend/src/components/CodeBlock.jsx` (New)

```jsx
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodeBlock({ children, className }) {
    const [copied, setCopied] = useState(false);
    const language = className?.replace('language-', '') || 'text';
    const code = String(children).replace(/\n$/, '');

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group">
            <button
                onClick={handleCopy}
                className="absolute right-2 top-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? '✓ Copied' : 'Copy'}
            </button>
            <SyntaxHighlighter
                language={language}
                style={oneDark}
                customStyle={{ margin: 0, borderRadius: '0.5rem' }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
}
```

### Backend Changes

#### File: `backend/conversation/routes/imageRoutes.js` (New)

```javascript
const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

// Get image by UUID
router.get('/:uuid', imageController.getImageByUuid);

module.exports = router;
```

#### File: `backend/conversation/controllers/imageController.js` (New)

```javascript
const Image = require('../models/Image');

const getImageByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const image = await Image.findOne({ uuid });
        
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Return image data
        res.json({
            uuid: image.uuid,
            url: image.url,           // If stored as URL
            base64: image.base64,     // If stored as base64
            mimeType: image.mimeType,
            alt: image.alt
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
};

module.exports = { getImageByUuid };
```

---

## 5️⃣ Rendering Pipeline

### How ReactMarkdown Processes Content

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RENDERING PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. RAW MARKDOWN INPUT                                                       │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ # Welcome                                                          │   │
│     │                                                                    │   │
│     │ Here is the screenshot:                                            │   │
│     │                                                                    │   │
│     │ ![Staff Center](img:550e8400-e29b-41d4-a716-446655440000)         │   │
│     │                                                                    │   │
│     │ ```python                                                          │   │
│     │ print("Hello")                                                     │   │
│     │ ```                                                                │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  2. REMARK PARSES TO AST                                                     │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ {                                                                  │   │
│     │   type: 'root',                                                    │   │
│     │   children: [                                                      │   │
│     │     { type: 'heading', depth: 1, children: [...] },               │   │
│     │     { type: 'paragraph', children: [...] },                       │   │
│     │     { type: 'image', url: 'img:550e...', alt: 'Staff Center' },   │   │
│     │     { type: 'code', lang: 'python', value: 'print("Hello")' }     │   │
│     │   ]                                                                │   │
│     │ }                                                                  │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  3. CUSTOM RENDERERS TRANSFORM                                               │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ heading → <h1 className="...">Welcome</h1>                        │   │
│     │ paragraph → <p>Here is the screenshot:</p>                        │   │
│     │ image → <ImageRenderer src="img:550e..." alt="Staff Center" />    │   │
│     │         ↓                                                          │   │
│     │         Detects UUID, fetches from API, renders <img>             │   │
│     │ code → <CodeBlock language="python">print("Hello")</CodeBlock>    │   │
│     │        ↓                                                          │   │
│     │        Syntax highlighting + copy button                          │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  4. FINAL HTML OUTPUT                                                        │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ <h1>Welcome</h1>                                                   │   │
│     │ <p>Here is the screenshot:</p>                                    │   │
│     │ <img src="data:image/png;base64,..." alt="Staff Center" />        │   │
│     │ <pre><code class="language-python">print("Hello")</code></pre>    │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6️⃣ Streaming Re-render Behavior

### Block Detection During Streaming

The frontend **re-parses the entire content** on each token. This is intentional:

| Partial Content | What User Sees |
|-----------------|----------------|
| `# Welco` | Heading (incomplete) |
| `# Welcome\n\n\`\`\`` | Heading + empty code block starting |
| `# Welcome\n\n\`\`\`python\nprint(` | Heading + code block (incomplete) |
| `# Welcome\n\n\`\`\`python\nprint("Hi")\n\`\`\`` | Heading + complete code block with styling |
| `![alt](img:550e` | Plain text (incomplete image syntax) |
| `![alt](img:550e8400-...)` | Image placeholder → fetches → displays |

### Why Re-parsing Works

1. **Code blocks**: Need closing ` ``` ` to apply syntax highlighting
2. **Tables**: Need complete row to render properly
3. **Images**: Need complete `![](...)` to trigger fetch
4. **ReactMarkdown** handles partial content gracefully - incomplete blocks render as text until closed

---

## 7️⃣ Image Storage Strategy

### Key Principle: Store Relative Paths, Not Full URLs

Store only the **relative image path** in ChromaDB metadata. The frontend/backend resolves the full URL based on environment configuration.

```
✅ Stored in metadata:  "images/550e8400-e29b-41d4-a716-446655440000.png"
❌ NOT stored:          "http://localhost:8000/images/550e8400-..."
❌ NOT stored:          "https://s3.amazonaws.com/bucket/images/550e8400-..."
```

This allows switching storage providers without re-ingesting documents.

---

### Image Path Format

```
images/<uuid>.png
```

**Examples of full URL resolution:**

| Environment | Base URL | Full URL |
|-------------|----------|----------|
| Local Dev (FastAPI) | `http://localhost:8000/` | `http://localhost:8000/images/550e8400-....png` |
| Local Dev (Express) | `http://localhost:4004/api/` | `http://localhost:4004/api/images/550e8400-....png` |
| AWS S3 | `https://my-bucket.s3.amazonaws.com/` | `https://my-bucket.s3.amazonaws.com/images/550e8400-....png` |
| Azure Blob | `https://myaccount.blob.core.windows.net/container/` | `https://myaccount.blob.core.windows.net/container/images/550e8400-....png` |
| CDN | `https://cdn.example.com/` | `https://cdn.example.com/images/550e8400-....png` |

---

### Configuration

#### Environment Variable

```env
# .env
IMAGE_BASE_URL=http://localhost:8000/   # Local development
# IMAGE_BASE_URL=https://my-bucket.s3.amazonaws.com/   # Production S3
# IMAGE_BASE_URL=https://cdn.example.com/              # Production CDN
```

#### Frontend Config

```javascript
// frontend/src/config.js
export const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:8000/';
```

```env
# frontend/.env
VITE_IMAGE_BASE_URL=http://localhost:8000/
```

#### Backend Config (Python)

```python
# backend/llm/config/settings.py
import os

IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", "http://localhost:8000/")
```

---

### Storage Implementation

#### 1. Save Image During Ingestion

```python
# backend/llm/services/image_storage.py
import uuid
from pathlib import Path

IMAGE_STORAGE_PATH = Path("./data/screenshots/")
IMAGE_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

def save_image(pil_image, source_doc: str = None, page: int = None) -> str:
    """
    Save PIL image to disk and return RELATIVE path.
    The relative path is storage-provider agnostic.
    """
    image_uuid = str(uuid.uuid4())
    filename = f"{image_uuid}.png"
    
    # Save to local disk (or upload to S3/Azure in production)
    filepath = IMAGE_STORAGE_PATH / filename
    pil_image.save(filepath, "PNG")
    
    # Return RELATIVE path (no base URL)
    return f"images/{filename}"  # "images/550e8400-e29b-41d4-a716-446655440000.png"
```

#### 2. Store in ChromaDB Metadata

```python
# During document ingestion
collection.add(
    ids=["chunk_1"],
    documents=["Click on Staff Center to open the menu..."],
    metadatas=[{
        "source": "ATOSS_Training_v1.0.pdf",
        "page": 15,
        "image": "images/550e8400-e29b-41d4-a716-446655440000.png"  # RELATIVE path
    }]
)
```

#### 3. LLM Generates Response with Relative Path

```python
# RAG context includes relative image path
context = """
Document: ATOSS Training Manual
Page 15 contains image: images/550e8400-e29b-41d4-a716-446655440000.png
Description: Screenshot of Staff Center main menu
"""

# LLM generates response
response = """
Here's the Staff Center menu:

![Staff Center](images/550e8400-e29b-41d4-a716-446655440000.png)
"""
```

#### 4. Frontend Resolves Full URL

```jsx
// frontend/src/components/AIMessage.jsx
import { IMAGE_BASE_URL } from '../config';

const ImageRenderer = ({ src, alt }) => {
    const [imageSrc, setImageSrc] = useState(null);

    useEffect(() => {
        // Check if src is a relative path (not starting with http)
        if (src && !src.startsWith('http')) {
            // Resolve to full URL using configured base
            setImageSrc(`${IMAGE_BASE_URL}${src}`);
        } else {
            // Already a full URL, use directly
            setImageSrc(src);
        }
    }, [src]);

    return <img src={imageSrc} alt={alt} loading="lazy" />;
};
```

---

### Serving Images

#### Option A: Local File System (Development)

```python
# backend/llm/main.py
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/images", StaticFiles(directory="data/screenshots"), name="images")
```

#### Option B: AWS S3 (Production)

```python
# backend/llm/services/image_storage.py
import boto3

s3 = boto3.client('s3')
BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

def save_image_s3(pil_image) -> str:
    """Upload to S3, return relative path"""
    image_uuid = str(uuid.uuid4())
    key = f"images/{image_uuid}.png"
    
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    buffer.seek(0)
    
    s3.upload_fileobj(buffer, BUCKET_NAME, key, ExtraArgs={'ContentType': 'image/png'})
    
    return key  # "images/550e8400-e29b-41d4-a716-446655440000.png"
```

#### Option C: Azure Blob Storage (Production)

```python
from azure.storage.blob import BlobServiceClient

def save_image_azure(pil_image) -> str:
    """Upload to Azure Blob, return relative path"""
    image_uuid = str(uuid.uuid4())
    blob_name = f"images/{image_uuid}.png"
    
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    buffer.seek(0)
    
    blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_name)
    blob_client.upload_blob(buffer, content_type="image/png")
    
    return blob_name  # "images/550e8400-e29b-41d4-a716-446655440000.png"
```

#### Option D: MongoDB with Base64

Store images directly in MongoDB as base64 strings. Use a special prefix `mongodb:` to indicate the image should be fetched from the API.

**MongoDB Model:**

```javascript
// backend/conversation/models/Image.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    base64: {
        type: String,  // Base64 encoded image data
        required: true
    },
    mimeType: {
        type: String,
        default: 'image/png'
    },
    alt: String,
    sourceDocument: String,
    page: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Image', imageSchema);
```

**Save Image to MongoDB:**

```python
# backend/llm/services/image_storage.py
import base64
import requests
from io import BytesIO

MONGODB_IMAGE_API = os.getenv("MONGODB_IMAGE_API", "http://localhost:4004/api/images")

def save_image_mongodb(pil_image, source_doc: str = None, page: int = None) -> str:
    """Save image to MongoDB via API, return reference path"""
    image_uuid = str(uuid.uuid4())
    
    # Convert to base64
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    base64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    # Save via API
    requests.post(MONGODB_IMAGE_API, json={
        "uuid": image_uuid,
        "base64": base64_data,
        "mimeType": "image/png",
        "sourceDocument": source_doc,
        "page": page
    })
    
    # Return special mongodb: prefix path
    return f"mongodb:{image_uuid}"  # "mongodb:550e8400-e29b-41d4-a716-446655440000"
```

**API Endpoint to Fetch:**

```javascript
// backend/conversation/controllers/imageController.js
const Image = require('../models/Image');

const getImageByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;
        const image = await Image.findOne({ uuid });
        
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Return as data URI for direct use in <img src>
        res.json({
            uuid: image.uuid,
            dataUri: `data:${image.mimeType};base64,${image.base64}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch image' });
    }
};

// Route: GET /api/images/:uuid
```

**Frontend Handling:**

```jsx
// frontend/src/components/AIMessage.jsx
const ImageRenderer = ({ src, alt }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!src) return;

        // Option D: MongoDB reference (mongodb:<uuid>)
        if (src.startsWith('mongodb:')) {
            const uuid = src.replace('mongodb:', '');
            setLoading(true);
            fetch(`${API_BASE_URL}/api/images/${uuid}`)
                .then(res => res.json())
                .then(data => setImageSrc(data.dataUri))
                .catch(err => console.error('Image fetch error:', err))
                .finally(() => setLoading(false));
        }
        // Options A/B/C: Relative path (images/<uuid>.png)
        else if (!src.startsWith('http') && !src.startsWith('data:')) {
            setImageSrc(`${IMAGE_BASE_URL}${src}`);
        }
        // Already a full URL or data URI
        else {
            setImageSrc(src);
        }
    }, [src]);

    if (loading) return <div className="animate-pulse bg-gray-200 h-32 rounded" />;
    return imageSrc ? <img src={imageSrc} alt={alt} loading="lazy" /> : null;
};
```

**Pros:**
- ✅ All data in one database (MongoDB)
- ✅ Easy backup/restore with mongodump
- ✅ No file system management
- ✅ Works well for small/medium images

**Cons:**
- ❌ Base64 encoding adds ~33% size overhead
- ❌ MongoDB document size limit (16MB per document)
- ❌ Requires API call to fetch (not static serving)

---

### Storage Options Summary

| Option | Storage Location | Path Format | Best For |
|--------|------------------|-------------|----------|
| A | Local File System | `images/<uuid>.png` | Development |
| B | AWS S3 | `images/<uuid>.png` | Production (AWS) |
| C | Azure Blob | `images/<uuid>.png` | Production (Azure) |
| D | MongoDB (base64) | `mongodb:<uuid>` | Simple deployment, small images |

**Choosing the Right Option:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHICH STORAGE TO USE?                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Small images (< 1MB) + Simple deployment?                       │
│  └─→ Option D: MongoDB base64                                    │
│                                                                  │
│  Many images + Need CDN/caching?                                 │
│  └─→ Options B/C: S3 or Azure Blob                              │
│                                                                  │
│  Local development?                                              │
│  └─→ Option A: Local file system                                │
│                                                                  │
│  Hybrid approach?                                                │
│  └─→ Use Option A locally, Option B/C in production             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Summary: Storage-Agnostic Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STORAGE-AGNOSTIC IMAGE HANDLING                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. INGESTION (Save image, store relative path)                              │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ save_image(pil_image) → "images/550e8400-....png"                 │   │
│     │                                                                    │   │
│     │ ChromaDB metadata: { "image": "images/550e8400-....png" }         │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  2. LLM RESPONSE (Uses relative path)                                        │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ "Here's the screenshot:                                           │   │
│     │  ![Menu](images/550e8400-....png)"                                │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  3. FRONTEND (Resolves full URL from config)                                 │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ IMAGE_BASE_URL + "images/550e8400-....png"                        │   │
│     │                                                                    │   │
│     │ Dev:  "http://localhost:8000/images/550e8400-....png"             │   │
│     │ Prod: "https://cdn.example.com/images/550e8400-....png"           │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Switch storage providers without re-ingesting documents
- ✅ Same metadata works for local dev and production
- ✅ Frontend config controls URL resolution
- ✅ Easy to migrate from local → S3 → CDN

---

## 8️⃣ LLM Integration

### How LLM References Images

The LLM receives context about available images and can reference them:

```python
# RAG context includes relative image path
context = """
Document: ATOSS Training Manual
Page 15 contains image: images/550e8400-e29b-41d4-a716-446655440000.png
Description: Screenshot of Staff Center main menu
"""

# LLM generates response with relative path
response = """
To access the Staff Center, follow these steps:

1. Click on the menu icon
2. Select "Staff Center"

Here's what the menu looks like:

![Staff Center Menu](images/550e8400-e29b-41d4-a716-446655440000.png)

As shown above, the Staff Center option is in the left sidebar.
"""
```

---

## 9️⃣ File References

| Component | File Path | Purpose |
|-----------|-----------|---------|
| AI Message | `frontend/src/components/AIMessage.jsx` | Markdown rendering + image URL resolution |
| Frontend Config | `frontend/src/config.js` | `IMAGE_BASE_URL` configuration |
| Image Storage | `backend/llm/services/image_storage.py` | Save images, return relative paths |
| Image Serving | `backend/llm/main.py` | FastAPI static file mount (dev) |
| ChromaDB Metadata | - | Stores `"image": "images/<uuid>.png"` |

---

## 🔟 Summary

**This feature enables:**
1. ✅ Markdown parsing (headings, lists, code, tables, blockquotes)
2. ✅ Code syntax highlighting with copy button
3. ✅ Image rendering from relative paths
4. ✅ Storage-agnostic design (local/S3/Azure/CDN)
5. ✅ Streaming-compatible (re-renders as blocks complete)
6. ✅ Error handling for missing images

**Key Design Decisions:**
- Store **relative paths** (`images/<uuid>.png`) in metadata, not full URLs
- Frontend resolves full URL using `IMAGE_BASE_URL` from config
- Same ingested data works across dev/staging/production environments
- Easy migration between storage providers
