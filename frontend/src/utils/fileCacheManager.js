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
 * @param {string} documentId - Document ID to remove
 */
export const removeUploadedFile = (documentId) => {
    const files = getUploadedFiles();
    const filtered = files.filter(f => f.documentId !== documentId);
    saveUploadedFiles(filtered);

    // Also clear the content cache for this file
    clearCache(`${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`);
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
 * Move a file from uploaded to ingested
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

        // Remove from uploaded files
        const filtered = uploadedFiles.filter(f => f.documentId !== documentId);
        saveUploadedFiles(filtered);

        // Clear content cache (no longer needed)
        clearCache(`${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`);

        // Save embedding data
        const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
        saveToCache(embeddingKey, embeddingData);
    }
};

/**
 * Remove an ingested file from cache
 * @param {string} documentId - Document ID to remove
 */
export const removeIngestedFile = (documentId) => {
    const files = getIngestedFiles();
    const filtered = files.filter(f => f.documentId !== documentId);
    saveIngestedFiles(filtered);

    // Also clear the embedding cache
    clearCache(`${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`);
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
};
