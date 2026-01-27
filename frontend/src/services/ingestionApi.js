/**
 * Ingestion API Service
 * 
 * All API calls for the document ingestion feature.
 * Connects to the backend ingestion service at VITE_INGESTION_URL.
 * 
 * Note: Frontend manages all document state in localStorage.
 * Backend is stateless and only provides processing/AI functionality.
 */

import axios from 'axios';

// Ingestion service URL
const INGESTION_URL = import.meta.env.VITE_INGESTION_URL || 'http://localhost:4005';

// Create axios instance for ingestion service
const ingestionApi = axios.create({
    baseURL: INGESTION_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests if available
ingestionApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get backend configuration (available DBs, image classes, etc.)
 * @returns {Promise<Object>} - The backend configuration
 */
export const getBackendConfig = async () => {
    const response = await ingestionApi.get('/api/ingestion/config');
    return response.data;
};

// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================

/**
 * Upload a document for processing
 * Returns extracted content directly - frontend caches in localStorage.
 * 
 * @param {File} file - The file to upload
 * @param {Object} config - Optional processing configuration
 * @returns {Promise<{success: boolean, filename: string, content: Object}>}
 */
export const uploadDocument = async (file, config = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (Object.keys(config).length > 0) {
        formData.append('config', JSON.stringify(config));
    }

    const response = await ingestionApi.post('/api/ingestion/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

// ============================================================================
// EMBEDDING & INGESTION
// ============================================================================

/**
 * Preview embeddings that will be created from a document
 * @param {string} strategy - The ingestion strategy (embed_per_page, chunked_document, etc.)
 * @param {Object} documentState - The current document state with pages
 * @returns {Promise<Object>} - Preview of embeddings to be created
 */
export const previewEmbeddings = async (strategy, documentState) => {
    const response = await ingestionApi.post('/api/ingestion/preview', {
        strategy,
        documentState,
    });
    return response.data;
};

/**
 * Ingest document content into a vector database
 * @param {string} targetDb - The target database ID
 * @param {Object} documentState - The document state to ingest
 * @param {string} strategy - The ingestion strategy
 * @returns {Promise<{success: boolean, ...}>}
 */
export const startIngestion = async (targetDb, documentState, strategy = 'embed_per_page') => {
    const response = await ingestionApi.post('/api/ingestion/ingest', {
        targetDb,
        documentState,
        strategy,
    });
    return response.data;
};

// ============================================================================
// AI HELPERS
// ============================================================================

/**
 * Run a backend AI helper function
 * @param {string} helperId - The helper function ID
 * @param {Object} content - The document content to process
 * @param {Object} params - Optional parameters for the helper
 * @returns {Promise<{success: boolean, modifiedItems: Array, message?: string}>}
 */
export const runBackendHelper = async (helperId, content, params = {}) => {
    const response = await ingestionApi.post('/api/ingestion/helper', {
        helperId,
        content,
        params,
    });
    return response.data;
};

// Export all functions as named exports
export default {
    getBackendConfig,
    uploadDocument,
    previewEmbeddings,
    startIngestion,
    runBackendHelper,
};
