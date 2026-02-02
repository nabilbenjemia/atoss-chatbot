# Feature: Slides Q&A Ingestion for RAG

## Overview
Ingest slides containing Q&A content (questions with step-by-step answers including text and screenshots) into the vector database for RAG-based retrieval.

## Objective
When a user asks a question related to the slides content, the RAG system should:
1. Find the most relevant question(s) via semantic search
2. Return the associated step-by-step answer text
3. Display accompanying screenshots with each step

---

## Feasibility Analysis

### 1. Slide Parsing with Docling

#### ✅ **FEASIBLE** - Docling supports PPTX natively

**Docling Capabilities:**
- **PPTX Support**: Native support for PowerPoint files (`.pptx`, `.potx`, `.ppsx`, `.pptm`, `.potm`, `.ppsm`)
- **Image Extraction**: Can extract embedded images via `PictureItem` class
- **Text Extraction**: Extracts titles, bullet points, paragraphs, and table content
- **Structured Output**: Provides `DoclingDocument` format with:
  - `texts`: All text items (paragraphs, headings)
  - `pictures`: All `PictureItem` objects
  - `tables`: Table structures

**Code Reference (from docling backend):**
```python
# docling/backend/mspowerpoint_backend.py
def handle_pictures(self, shape, parent_slide, slide_ind, doc, slide_size):
    image = shape.image
    image_bytes = image.blob
    im_dpi, _ = image.dpi
    pil_image = Image.open(BytesIO(image_bytes))
    
    doc.add_picture(
        parent=parent_slide,
        image=ImageRef.from_pil(image=pil_image, dpi=im_dpi),
        caption=None,
        prov=prov,
    )
```

**Installation:**
```bash
pip install docling
```

---

### 2. Extracting Questions, Steps, and Screenshots

#### ⚠️ **PARTIALLY FEASIBLE** - Requires custom parsing logic

**Challenge**: Docling extracts all content but doesn't understand Q&A semantics. You need custom logic to:
1. Identify which text is a "question"
2. Associate subsequent text/bullets as "steps"
3. Link screenshots to their corresponding steps

**Proposed Approach:**

```python
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling_core.types.doc import PictureItem, TextItem

def extract_qa_from_slides(pptx_path: str):
    converter = DocumentConverter(allowed_formats=[InputFormat.PPTX])
    result = converter.convert(pptx_path)
    doc = result.document
    
    qa_items = []
    current_question = None
    current_steps = []
    current_screenshots = []
    
    for element, level in doc.iterate_items():
        if isinstance(element, TextItem):
            text = element.text.strip()
            
            # Heuristic: Questions often end with "?" or are slide titles
            if text.endswith("?") or element.label == "TITLE":
                # Save previous Q&A if exists
                if current_question:
                    qa_items.append({
                        "question": current_question,
                        "steps": current_steps,
                        "screenshots": current_screenshots
                    })
                current_question = text
                current_steps = []
                current_screenshots = []
            else:
                # Treat as a step
                current_steps.append(text)
                
        elif isinstance(element, PictureItem):
            # Get image bytes
            pil_image = element.get_image(doc)
            current_screenshots.append(pil_image)
    
    return qa_items
```

**Considerations:**
- Slide structure varies; heuristics may need refinement
- Consider using slide notes for additional context
- May need position-based logic (screenshots near steps)

---

### 3. Storing Images as Metadata

#### ⚠️ **FEASIBLE with Workarounds** - ChromaDB doesn't store binary data natively

**ChromaDB Metadata Limitations:**
- Metadata supports: `str`, `int`, `float`, `bool`
- **Does NOT support**: binary data, nested objects, lists of objects

**Solution Options:**

#### Option A: Base64 Encoding in Metadata (Simple, but large)
```python
import base64
from io import BytesIO

def image_to_base64(pil_image) -> str:
    buffer = BytesIO()
    pil_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

# Store in metadata
collection.add(
    ids=["q1"],
    documents=["How do I reset my password?"],
    metadatas=[{
        "step_1_text": "Click on 'Forgot Password'",
        "step_1_screenshot": image_to_base64(screenshot_1),  # Large string
        "step_2_text": "Enter your email",
        "step_2_screenshot": image_to_base64(screenshot_2),
    }]
)
```

**Pros:**
- Simple implementation
- All data in one place

**Cons:**
- ChromaDB metadata has size limits
- Large base64 strings impact performance
- Not queryable

#### Option B: External Storage with References (Recommended)
```python
import os
import uuid

IMAGE_STORAGE_PATH = "./data/screenshots/"

def save_screenshot(pil_image) -> str:
    """Save image to disk and return path/URL"""
    image_id = str(uuid.uuid4())
    path = f"{IMAGE_STORAGE_PATH}{image_id}.png"
    pil_image.save(path, "PNG")
    return path  # Or return a URL if serving via web server

# Store reference in metadata
collection.add(
    ids=["q1"],
    documents=["How do I reset my password?"],
    metadatas=[{
        "steps": json.dumps([
            {"text": "Click on 'Forgot Password'", "screenshot": "/data/screenshots/abc123.png"},
            {"text": "Enter your email", "screenshot": "/data/screenshots/def456.png"},
        ])
    }]
)
```

**Pros:**
- No size limitations
- Efficient storage
- Scalable

**Cons:**
- Need to manage external storage
- Need to serve images (static file server or cloud storage)

#### Option C: Hybrid with Data URIs for Frontend
```python
# At query time, convert to data URI for frontend display
def get_data_uri(image_path: str) -> str:
    with open(image_path, "rb") as f:
        base64_data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/png;base64,{base64_data}"
```

---

### 4. RAG Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INGESTION FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PPTX File                                                           │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────┐    ┌─────────────────┐    ┌────────────────────┐   │
│  │  Docling   │───▶│ Custom Parser   │───▶│  Screenshot Store  │   │
│  │  Converter │    │ (Q&A Extractor) │    │  (Filesystem/S3)   │   │
│  └────────────┘    └─────────────────┘    └────────────────────┘   │
│                            │                        │               │
│                            ▼                        │               │
│                    ┌───────────────┐                │               │
│                    │  ChromaDB     │◀───────────────┘               │
│                    │  - Question   │   (screenshot paths)           │
│                    │    embedding  │                                │
│                    │  - Steps text │                                │
│                    │  - Screenshot │                                │
│                    │    references │                                │
│                    └───────────────┘                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         QUERY FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Question                                                       │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────┐    ┌─────────────────┐    ┌────────────────────┐   │
│  │  Embedding │───▶│  ChromaDB       │───▶│  Result Formatter  │   │
│  │  Model     │    │  Similarity     │    │  (Load screenshots)│   │
│  └────────────┘    │  Search         │    └────────────────────┘   │
│                    └─────────────────┘             │                │
│                                                    ▼                │
│                                           ┌───────────────┐        │
│                                           │  LLM Response │        │
│                                           │  + Screenshots│        │
│                                           └───────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5. Implementation Plan

#### Phase 1: Slide Parsing Module
```python
# backend/llm/services/slides_ingestion_service.py

from dataclasses import dataclass
from typing import List, Optional
from PIL import Image

@dataclass
class Step:
    order: int
    text: str
    screenshot_path: Optional[str] = None

@dataclass
class QAItem:
    question: str
    steps: List[Step]
    slide_number: int
    source_file: str

class SlidesIngestionService:
    def __init__(self, screenshot_storage_path: str):
        self.screenshot_storage_path = screenshot_storage_path
        
    def ingest_slides(self, pptx_path: str) -> List[QAItem]:
        """Parse PPTX and extract Q&A items"""
        pass
        
    def save_screenshot(self, image: Image.Image, qa_id: str, step_order: int) -> str:
        """Save screenshot and return path"""
        pass
```

#### Phase 2: Vector Store Integration
```python
# backend/llm/services/qa_vectorstore_service.py

class QAVectorStoreService:
    def __init__(self, collection_name: str = "slides_qa"):
        self.collection = chromadb_client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_function
        )
    
    def add_qa_items(self, qa_items: List[QAItem]):
        """Embed questions and store with step metadata"""
        for qa in qa_items:
            steps_json = json.dumps([
                {"order": s.order, "text": s.text, "screenshot": s.screenshot_path}
                for s in qa.steps
            ])
            
            self.collection.add(
                ids=[f"{qa.source_file}_{qa.slide_number}"],
                documents=[qa.question],
                metadatas=[{
                    "steps": steps_json,
                    "slide_number": qa.slide_number,
                    "source_file": qa.source_file
                }]
            )
    
    def search(self, query: str, n_results: int = 3):
        """Search for relevant Q&A items"""
        return self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
```

#### Phase 3: API Response with Screenshots
```python
# Backend response structure
{
    "answer": "To reset your password, follow these steps...",
    "source_qa": {
        "question": "How do I reset my password?",
        "steps": [
            {
                "order": 1,
                "text": "Click on 'Forgot Password' link",
                "screenshot_url": "/api/screenshots/abc123.png"
            },
            {
                "order": 2,
                "text": "Enter your email address",
                "screenshot_url": "/api/screenshots/def456.png"
            }
        ]
    }
}
```

---

### 6. Frontend Considerations

The frontend will need to:
1. Display the LLM-generated answer
2. Render step-by-step instructions with screenshots
3. Support image lightbox/zoom functionality

```jsx
// Example React component
const StepWithScreenshot = ({ step }) => (
  <div className="step">
    <span className="step-number">{step.order}.</span>
    <p className="step-text">{step.text}</p>
    {step.screenshot_url && (
      <img 
        src={step.screenshot_url} 
        alt={`Step ${step.order}`}
        className="step-screenshot"
        onClick={() => openLightbox(step.screenshot_url)}
      />
    )}
  </div>
);
```

---

### 7. Dependencies

**New Python Packages:**
```txt
# requirements.txt additions
docling>=2.68.0
python-pptx>=0.6.21  # Docling dependency
```

---

### 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Q&A structure varies across slides | High | Define clear slide templates; add manual correction UI |
| Large screenshots increase storage | Medium | Compress images; use thumbnails in listing, full-size on click |
| Screenshot-step association errors | Medium | Use position heuristics; allow manual corrections |
| ChromaDB metadata size limits | Low | Use external storage for images (recommended approach) |
| Docling parsing errors | Low | Add error handling; fallback to manual extraction |

---

### 9. Alternative Approaches Considered

1. **Multimodal Embeddings**: Embed both text AND images using CLIP-like models
   - Pro: More semantically aware
   - Con: More complex, requires multimodal LLM

2. **Full Page Screenshots**: Capture entire slide as one image
   - Pro: Simpler parsing
   - Con: Harder to reference specific steps

3. **PDF Conversion First**: Convert PPTX → PDF → Process
   - Pro: More consistent parsing
   - Con: Additional step, potential quality loss

---

### 10. Recommended Implementation Path

1. **Start Simple**: 
   - Use Option B (external storage with references)
   - Define a consistent slide template for Q&A content
   
2. **Iterate**:
   - Build manual correction UI for misparsed content
   - Add support for variations in slide structure

3. **Scale**:
   - Move screenshots to cloud storage (S3/GCS)
   - Add caching layer for frequently accessed screenshots

---

## Summary

| Aspect | Feasibility | Notes |
|--------|-------------|-------|
| PPTX Parsing | ✅ Feasible | Docling supports natively |
| Image Extraction | ✅ Feasible | Via `PictureItem.get_image()` |
| Q&A Semantic Extraction | ⚠️ Partial | Requires custom parsing logic |
| Image Storage in ChromaDB | ⚠️ Workaround | Use external storage with references |
| RAG Integration | ✅ Feasible | Standard embedding + metadata approach |
| Frontend Display | ✅ Feasible | Standard image rendering |

**Verdict**: The feature is **implementable** with some custom development for Q&A extraction logic and image storage management.

---

## Next Steps for GitLab Issue

1. Create subtasks for each phase
2. Define slide template requirements
3. Set up screenshot storage infrastructure
4. Implement and test parsing logic
5. Integrate with existing RAG pipeline
