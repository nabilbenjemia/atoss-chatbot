/**
 * Document Status Constants
 * 
 * Shared constants for document status tracking.
 */

export const DOC_STATUS = {
    QUEUED: 'queued',
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    READY: 'ready',
    INGESTING: 'ingesting',
    COMPLETED: 'completed',
    INGESTED: 'ingested', // File has been ingested, embeddings stored locally
    ERROR: 'error',
};

/**
 * Content type - whether file is showing editor or embedding view
 */
export const CONTENT_TYPE = {
    EDITOR: 'editor',       // ContentViewer - pages with items
    EMBEDDING: 'embedding', // EmbeddingPreviewViewer - embeddings (read-only)
};
