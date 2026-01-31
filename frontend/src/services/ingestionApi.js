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

/**
 * Create a new ChromaDB collection
 * @param {string} name - Collection name (will be used as directory name)
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, collection: Object, message: string}>}
 */
export const createCollection = async (name, description = null) => {
    const response = await ingestionApi.post('/api/ingestion/collection', {
        name,
        description,
    });
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
 * LOCAL STRATEGIES - IDs that are handled in frontend
 * These strategies do not require backend processing
 */
const LOCAL_STRATEGIES = ['embed_per_page', 'chunked_fixed', 'chunked_document'];

/**
 * Generate embedding preview locally (for local strategies)
 * This is the frontend implementation of preview generation.
 * 
 * @param {string} strategy - The embedding strategy
 * @param {Object} documentState - The document state with pages
 * @returns {Object} - Preview of embeddings
 */
const generateLocalPreview = (strategy, documentState) => {
    const documents = [];

    if (strategy === 'embed_per_page') {
        // Page-based embedding: one embedding per page
        (documentState.pages || []).forEach((page, idx) => {
            const pageNum = page.pageNumber || idx + 1;
            const activeItems = (page.items || []).filter(item => !item.deleted);

            // Combine all text content from the page
            const textContent = activeItems
                .filter(item => item.type === 'text')
                .map(item => item.content)
                .join('\n\n');

            // Gather image data
            const images = activeItems
                .filter(item => item.type === 'image')
                .map(item => ({
                    uuid: item.id,
                    imageUrl: item.imageUrl,
                    imageWidth: item.imageWidth,
                    imageHeight: item.imageHeight,
                    classification: item.classification || 'unknown',
                    description: item.description,
                }));

            // Gather table data as markdown
            const tableContent = activeItems
                .filter(item => item.type === 'table')
                .map(item => {
                    if (!item.tableData) return '';
                    const headers = item.tableData.headers?.join(' | ') || '';
                    const separator = item.tableData.headers?.map(() => '---').join(' | ') || '';
                    const rows = item.tableData.rows?.map(row => row.join(' | ')).join('\n| ') || '';
                    return `| ${headers} |\n| ${separator} |\n| ${rows} |`;
                })
                .filter(Boolean)
                .join('\n\n');

            const tables = activeItems
                .filter(item => item.type === 'table')
                .map(item => ({
                    id: item.id,
                    tableData: item.tableData,
                }));

            const fullContent = [textContent, tableContent].filter(Boolean).join('\n\n');

            if (fullContent.trim() || images.length > 0) {
                documents.push({
                    id: `page_${pageNum}`,
                    content: fullContent,
                    metadata: {
                        page_num: pageNum,
                        source: documentState.filename || 'unknown',
                        document_type: 'pdf',
                        image_count: images.length,
                        images: images.length > 0 ? images : undefined,
                        tables: tables.length > 0 ? tables : undefined,
                        char_count: fullContent.length,
                        word_count: fullContent.split(/\s+/).filter(Boolean).length,
                    },
                });
            }
        });
    } else if (strategy === 'chunked_fixed' || strategy === 'chunked_document') {
        // Fixed-size chunking: merge all content and split into chunks with overlap
        const allContent = (documentState.pages || []).flatMap(page =>
            (page.items || [])
                .filter(item => !item.deleted && item.type === 'text')
                .map(item => item.content)
        ).join('\n\n');

        // Chunk with ~500 character chunks with overlap
        const chunkSize = 500;
        const overlap = 100;
        let position = 0;
        let chunkIndex = 1;

        while (position < allContent.length) {
            const end = Math.min(position + chunkSize, allContent.length);
            const chunk = allContent.slice(position, end);

            documents.push({
                id: `chunk_${chunkIndex}`,
                content: chunk,
                metadata: {
                    chunk_index: chunkIndex,
                    source: documentState.filename || 'unknown',
                    document_type: 'pdf',
                    char_count: chunk.length,
                    word_count: chunk.split(/\s+/).filter(Boolean).length,
                    start_position: position,
                    end_position: end,
                },
            });

            position = end - overlap;
            if (position >= allContent.length - overlap) break;
            chunkIndex++;
        }
    }

    return {
        source: documentState.filename || 'unknown',
        document_type: 'pdf',
        page_count: documentState.totalPages || documentState.pages?.length || 0,
        total_embeddings: documents.length,
        strategy: strategy,
        documents,
    };
};

/**
 * Preview embeddings that will be created from a document
 * 
 * For LOCAL strategies (embed_per_page, chunked_fixed), preview is generated
 * in the frontend without calling backend.
 * For REMOTE strategies, calls backend API which proxies to LLM service.
 * 
 * @param {string} strategy - The ingestion strategy
 * @param {Object} documentState - The current document state with pages
 * @returns {Promise<Object>} - Preview of embeddings to be created
 */
export const previewEmbeddings = async (strategy, documentState) => {
    // Check if this is a local strategy
    if (LOCAL_STRATEGIES.includes(strategy)) {
        // Generate preview locally
        const preview = generateLocalPreview(strategy, documentState);
        return { success: true, preview };
    }

    // For remote strategies, call backend API
    const response = await ingestionApi.post('/api/ingestion/preview', {
        strategy,
        documentState,
    });
    return response.data;
};

/**
 * Ingest document content into a vector database
 * 
 * Accepts either pre-transformed documents array (from preview) or raw documentState.
 * If documentState is provided, it will be transformed to documents format.
 * 
 * @param {string} targetDb - The target database ID
 * @param {Array|Object} documentsOrState - Either documents array from preview, or documentState
 * @param {string} strategy - The ingestion strategy
 * @param {Object} options - Additional options
 * @param {string} options.source - Source filename for metadata
 * @returns {Promise<{success: boolean, ...}>}
 */
export const startIngestion = async (targetDb, documentsOrState, strategy = 'embed_per_page', options = {}) => {
    let documents;
    let source = options.source || 'unknown';
    
    // Check if this is already a documents array (from preview) or raw documentState
    if (Array.isArray(documentsOrState)) {
        // Already transformed documents array
        documents = documentsOrState;
    } else if (documentsOrState?.pages) {
        // Raw documentState - transform it locally
        const preview = generateLocalPreview(strategy, documentsOrState);
        documents = preview.documents;
        source = documentsOrState.filename || source;
    } else {
        throw new Error('Invalid input: expected documents array or documentState with pages');
    }
    
    const response = await ingestionApi.post('/api/ingestion/ingest', {
        targetDb,
        documents,
        strategy,
        source,
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

/**
 * Generate AI descriptions for images
 * Sends document ID and image data to backend for AI processing
 * @param {string} documentId - The document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @returns {Promise<{success: boolean, descriptions: Array<{imageId: string, description: string}>, message?: string}>}
 */
export const generateImageDescriptions = async (documentId, images) => {
    const response = await ingestionApi.post('/api/ingestion/helper/image-descriptions', {
        documentId,
        images,
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
    generateImageDescriptions,
};
