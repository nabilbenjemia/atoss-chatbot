/**
 * Ingestion Configuration
 * 
 * All configurable settings for the document ingestion feature.
 * Extensible - add new file types, helpers, or settings here without code changes.
 */

export const INGESTION_CONFIG = {
    // File upload settings
    upload: {
        maxFileSizeMB: 10, // Maximum file size in megabytes
        allowedTypes: ['.pdf'], // Extensible: add '.pptx', '.png', '.jpg' later
        allowedMimeTypes: ['application/pdf'], // Extensible: add more MIME types
        maxConcurrentUploads: 3,
    },

    // Image display settings
    image: {
        maxDisplayWidth: 400, // Threshold for resizing (pixels)
        maxDisplayHeight: 300, // Threshold for resizing (pixels)
        thumbnailSize: 150, // Size for thumbnails in trash panel
    },

    // Undo/redo settings
    history: {
        maxUndoSteps: 50, // Maximum undo history (NFR-002)
    },

    // Helper functions registry (extensible plugin pattern)
    helpers: {
        local: [
            {
                id: 'remove_logos',
                label: 'Remove All Logos',
                description: 'Delete all images classified as logos',
                type: 'local',
                icon: '🖼️',
            },
            {
                id: 'remove_empty',
                label: 'Remove Empty Text',
                description: 'Delete text items with only whitespace or single digits',
                type: 'local',
                icon: '📝',
            },
            {
                id: 'delete_regex',
                label: 'Delete by Regex...',
                description: 'Delete text items matching a regular expression',
                type: 'local',
                hasInput: true,
                icon: '🔍',
            },
        ],
        backend: [
            {
                id: 'ai_image_descriptions',
                label: 'Generate Image Descriptions (AI)',
                description: 'Use AI to generate descriptions for images',
                type: 'backend',
                icon: '🤖',
            },
            // TODO: Add more backend helpers as needed
        ],
    },

    // Polling intervals for async operations
    polling: {
        processingStatusMs: 2000, // Poll processing status every 2s
        ingestionStatusMs: 3000, // Poll ingestion status every 3s
    },

    // Local storage keys
    storage: {
        editStateKey: 'ingestion_edit_state',
        documentCacheKey: 'ingestion_document_cache',
        embeddingCachePrefix: 'ingestion_embeddings_', // Per-file: ingestion_embeddings_{documentId}
        ingestedFilesKey: 'ingestion_ingested_files', // List of ingested file IDs
        // New: Separate cache for uploaded files list and ingested files list
        uploadedFilesKey: 'ingestion_uploaded_files', // Array of uploaded file metadata
        contentFilesPrefix: 'ingestion_content_', // Per-file content: ingestion_content_{documentId}
    },

    // UI settings
    ui: {
        pageNavigationDebounceMs: 100, // Debounce for rapid page navigation
        autoSaveDebounceMs: 500, // Debounce for auto-save to localStorage
        toastDurationMs: 3000, // Toast notification duration
    },
};

// Helper function to get file size limit in bytes
export const getMaxFileSizeBytes = () => {
    return INGESTION_CONFIG.upload.maxFileSizeMB * 1024 * 1024;
};

// Helper function to validate file type
export const isValidFileType = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    const mimeType = file.type;

    return (
        INGESTION_CONFIG.upload.allowedTypes.includes(extension) ||
        INGESTION_CONFIG.upload.allowedMimeTypes.includes(mimeType)
    );
};

// Helper function to validate file size
export const isValidFileSize = (file) => {
    return file.size <= getMaxFileSizeBytes();
};

// Helper function to get human-readable file size limit
export const getFileSizeLimitText = () => {
    return `${INGESTION_CONFIG.upload.maxFileSizeMB}MB`;
};

// Helper function to get allowed file types as string
export const getAllowedTypesText = () => {
    return INGESTION_CONFIG.upload.allowedTypes.join(', ').toUpperCase();
};

export default INGESTION_CONFIG;
