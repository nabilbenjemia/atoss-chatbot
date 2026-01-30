/**
 * File Cache Manager
 * 
 * Utility functions for managing two types of cached files:
 * 1. Uploaded/Content files (for ContentViewer) - files uploaded but not yet ingested
 * 2. Ingested files (for EmbeddingPreview read mode) - files that have been ingested
 */

import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { loadFromCache, saveToCache, clearCache, getKeysWithPrefix } from '../hooks/useLocalCache';

/**
 * File metadata structure:
 * {
 *   id: string,          // Unique queue ID (upload_timestamp_random)
 *   documentId: string,  // Backend document ID
 *   filename: string,    // Original filename
 *   status: string,      // DOC_STATUS value
 *   uploadedAt: string,  // ISO timestamp
 *   ingestedAt?: string, // ISO timestamp (only for ingested files)
 * }
 */

// ==================== UPLOADED FILES (Content Viewer) ====================

/**
 * Get list of uploaded file metadata
 * @returns {Array} - Array of file metadata objects
 */
export const getUploadedFiles = () => {
    return loadFromCache(INGESTION_CONFIG.storage.uploadedFilesKey) || [];
};

/**
 * Save uploaded files list
 * @param {Array} files - Array of file metadata
 */
export const saveUploadedFiles = (files) => {
    saveToCache(INGESTION_CONFIG.storage.uploadedFilesKey, files);
};

/**
 * Add a new uploaded file to cache
 * @param {Object} fileMetadata - File metadata object
 */
export const addUploadedFile = (fileMetadata) => {
    const files = getUploadedFiles();
    // Check if already exists (by documentId)
    const exists = files.some(f => f.documentId === fileMetadata.documentId);
    if (!exists) {
        files.push({
            ...fileMetadata,
            uploadedAt: new Date().toISOString(),
        });
        saveUploadedFiles(files);
    }
};

/**
 * Update an uploaded file's metadata
 * @param {string} documentId - Document ID to update
 * @param {Object} updates - Fields to update
 */
export const updateUploadedFile = (documentId, updates) => {
    const files = getUploadedFiles();
    const index = files.findIndex(f => f.documentId === documentId);
    if (index !== -1) {
        files[index] = { ...files[index], ...updates };
        saveUploadedFiles(files);
    }
};

/**
 * Remove an uploaded file from cache
 * Also removes any ingested versions of this file and their embedding caches
 * 
 * @param {string} documentId - Document ID to remove
 * @returns {string[]} - Array of removed ingested IDs (for callers that need to update state)
 */
export const removeUploadedFile = (documentId) => {
    const files = getUploadedFiles();
    const filtered = files.filter(f => f.documentId !== documentId);
    saveUploadedFiles(filtered);

    // Also clear the content cache for this file
    clearCache(`${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`);

    // Also clear the command history for this file
    clearCache(`${INGESTION_CONFIG.storage.historyPrefix}${documentId}`);
    
    // Also remove any ingested versions of this file
    const ingestedFiles = getIngestedFiles();
    const relatedIngested = ingestedFiles.filter(f => f.documentId === documentId);
    const removedIngestedIds = relatedIngested.map(f => f.ingestedId);
    
    // Remove from ingested files list
    const filteredIngested = ingestedFiles.filter(f => f.documentId !== documentId);
    saveIngestedFiles(filteredIngested);
    
    // Clear embedding caches for removed ingested files
    removedIngestedIds.forEach(ingestedId => {
        clearCache(`${INGESTION_CONFIG.storage.embeddingCachePrefix}${ingestedId}`);
    });
    
    return removedIngestedIds;
};

/**
 * Save content data for a specific file
 * @param {string} documentId - Document ID
 * @param {Object} content - Extracted content data
 */
export const saveFileContent = (documentId, content) => {
    const key = `${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`;
    saveToCache(key, content);
};

/**
 * Get content data for a specific file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - Content data or null
 */
export const getFileContent = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`;
    return loadFromCache(key);
};

// ==================== INGESTED FILES (Embedding Preview) ====================

/**
 * Get list of ingested file metadata
 * @returns {Array} - Array of ingested file metadata
 */
export const getIngestedFiles = () => {
    return loadFromCache(INGESTION_CONFIG.storage.ingestedFilesKey) || [];
};

/**
 * Save ingested files list
 * @param {Array} files - Array of ingested file metadata
 */
export const saveIngestedFiles = (files) => {
    saveToCache(INGESTION_CONFIG.storage.ingestedFilesKey, files);
};

/**
 * Create or update an ingested file entry
 * - Does NOT remove the uploaded file (user may want to re-ingest with different strategy)
 * - Creates ingested entry keyed by documentId + strategy
 * - If same documentId + strategy exists, updates it (preserves ability to re-ingest)
 * - If different strategy, creates new entry
 * 
 * @param {string} documentId - Original document ID
 * @param {string} strategy - Ingestion strategy used
 * @param {Object} embeddingData - Embedding preview data to cache
 * @param {Object} fileInfo - Optional file info (filename, etc.) - if not provided, will look up from uploaded files
 * @param {string} [targetDb] - Target database (optional)
 */
export const createIngestedFile = (documentId, strategy, embeddingData, fileInfo = null, targetDb = null) => {
    // Get file info from uploaded files if not provided
    let file = fileInfo;
    if (!file) {
        const uploadedFiles = getUploadedFiles();
        file = uploadedFiles.find(f => f.documentId === documentId);
    }

    if (!file) {
        console.warn('[fileCacheManager] No file info found for', documentId);
        return null;
    }

    // Create unique ingested ID based on documentId + strategy
    const ingestedId = `${documentId}_${strategy}`;

    // Get existing ingested files
    const ingestedFiles = getIngestedFiles();
    const existingIndex = ingestedFiles.findIndex(f => f.ingestedId === ingestedId);

    // Calculate embedding count from the embedding data
    const embeddingCount = embeddingData?.chunks?.length || 
                           embeddingData?.embeddings?.length || 
                           embeddingData?.count || 0;

    const ingestedEntry = {
        id: ingestedId,
        ingestedId,
        documentId,  // Keep reference to original document
        strategy,
        targetDb: targetDb || 'default',
        filename: `${file.filename} (${strategy})`,
        originalFilename: file.filename,
        timestamp: Date.now(),
        ingestedAt: new Date().toISOString(),
        status: 'ingested',
        embeddingCount,
    };

    if (existingIndex >= 0) {
        // Update existing entry
        ingestedFiles[existingIndex] = {
            ...ingestedFiles[existingIndex],
            ...ingestedEntry,
            ingestedAt: new Date().toISOString(), // Update timestamp
        };
    } else {
        // Add new entry
        ingestedFiles.push(ingestedEntry);
    }

    saveIngestedFiles(ingestedFiles);

    // Save embedding data with the ingested ID as key
    const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${ingestedId}`;
    saveToCache(embeddingKey, {
        ...embeddingData,
        strategy,
        documentId,
        ingestedId,
    });

    return ingestedEntry;
};

/**
 * Check if an ingested file with same documentId + strategy already exists
 * @param {string} documentId - Document ID
 * @param {string} strategy - Ingestion strategy
 * @returns {Object|null} - Existing ingested file or null
 */
export const getExistingIngestedFile = (documentId, strategy) => {
    const ingestedId = `${documentId}_${strategy}`;
    const ingestedFiles = getIngestedFiles();
    return ingestedFiles.find(f => f.ingestedId === ingestedId) || null;
};

/**
 * @deprecated Use createIngestedFile instead
 * Move a file from uploaded to ingested (legacy function)
 * @param {string} documentId - Document ID
 * @param {Object} embeddingData - Embedding preview data to cache
 */
export const markFileAsIngested = (documentId, embeddingData) => {
    // Get uploaded file info
    const uploadedFiles = getUploadedFiles();
    const file = uploadedFiles.find(f => f.documentId === documentId);

    if (file) {
        // Add to ingested files
        const ingestedFiles = getIngestedFiles();
        const exists = ingestedFiles.some(f => f.documentId === documentId);

        if (!exists) {
            ingestedFiles.push({
                ...file,
                ingestedAt: new Date().toISOString(),
                status: 'ingested',
            });
            saveIngestedFiles(ingestedFiles);
        }

        // NOTE: No longer removing from uploaded files or clearing caches
        // User may want to re-ingest with different strategy

        // Save embedding data
        const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
        saveToCache(embeddingKey, embeddingData);
    }
};

/**
 * Remove an ingested file from cache
 * Only removes the ingested file entry and its embedding cache.
 * Does NOT remove the uploaded file (user may want to re-ingest with different strategy).
 * 
 * @param {string} ingestedId - Ingested file ID (documentId_strategy format) or legacy documentId
 */
export const removeIngestedFile = (ingestedId) => {
    const files = getIngestedFiles();
    
    // Remove from ingested files list
    const filtered = files.filter(f =>
        f.ingestedId !== ingestedId && f.documentId !== ingestedId
    );
    saveIngestedFiles(filtered);

    // Clear the embedding cache
    clearCache(`${INGESTION_CONFIG.storage.embeddingCachePrefix}${ingestedId}`);
};

/**
 * Get embedding data for an ingested file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - Embedding data or null
 */
export const getIngestedFileEmbeddings = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
    return loadFromCache(key);
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if a file is ingested
 * @param {string} documentId - Document ID
 * @returns {boolean}
 */
export const isFileIngested = (documentId) => {
    const ingestedFiles = getIngestedFiles();
    return ingestedFiles.some(f => f.documentId === documentId);
};

/**
 * Get all cached files (both uploaded and ingested)
 * @returns {{ uploaded: Array, ingested: Array }}
 */
export const getAllCachedFiles = () => {
    return {
        uploaded: getUploadedFiles(),
        ingested: getIngestedFiles(),
    };
};

/**
 * Clear all file caches
 */
export const clearAllFileCaches = () => {
    // Clear file lists
    clearCache(INGESTION_CONFIG.storage.uploadedFilesKey);
    clearCache(INGESTION_CONFIG.storage.ingestedFilesKey);

    // Clear all content caches
    const contentKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.contentFilesPrefix);
    contentKeys.forEach(key => clearCache(key));

    // Clear all embedding caches
    const embeddingKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.embeddingCachePrefix);
    embeddingKeys.forEach(key => clearCache(key));

    // Clear all history caches
    const historyKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.historyPrefix);
    historyKeys.forEach(key => clearCache(key));
};

// ==================== COMMAND HISTORY ====================

/**
 * Save command history for a file
 * @param {string} documentId - Document ID
 * @param {Object} history - Command history { past, present, future }
 */
export const saveFileHistory = (documentId, history) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    // Only save past and future arrays (present is saved in content cache)
    saveToCache(key, {
        past: history.past,
        future: history.future,
    });
};

/**
 * Get command history for a file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - History { past, future } or null
 */
export const getFileHistory = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    return loadFromCache(key);
};

/**
 * Clear command history for a file
 * @param {string} documentId - Document ID
 */
export const clearFileHistory = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    clearCache(key);
};
