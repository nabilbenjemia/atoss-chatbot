/**
 * Ingestion Service
 * 
 * Page-level operations for the IngestionPage.
 * 
 * This service is a PROXY to LLM service + CONFIG PROVIDER:
 * - Aggregates local config (strategies, helpers, picture classes) with remote config
 * - Proxies requests to LLM service for document processing and ingestion
 * - Local strategies and helpers are defined in config but executed in FRONTEND
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

// Load local config files
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const pictureClassificationsConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'pictureClassifications.json'), 'utf8')
);
const localConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'localConfig.json'), 'utf8')
);

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get backend configuration
 * 
 * Fetches remote config from LLM service and merges with local config.
 * Falls back to local-only config if LLM service is unavailable.
 * 
 * @returns {Promise<Object>} Configuration with strategies, helpers, collections, imageClasses
 */
const getConfig = async () => {
    try {
        // Fetch remote config from LLM service
        console.log('[CONFIG] Fetching remote config from LLM service...');
        const response = await axios.get(`${LLM_SERVICE_URL}/api/ingestion/config`, {
            timeout: 5000,
        });
        const remoteConfig = response.data;
        console.log('[CONFIG] Remote config fetched successfully');

        return aggregateConfig(remoteConfig);
    } catch (error) {
        console.warn(`[CONFIG] LLM service unavailable: ${error.message}`);
        console.log('[CONFIG] Falling back to local-only config');
        return aggregateConfig(null);
    }
};

/**
 * Aggregate configuration from local and remote sources
 * 
 * Combines:
 * - pictureClassifications.json: Docling picture classes and categories (local)
 * - localConfig.json: Local helpers and strategies (executed in frontend)
 * - LLM service config: Remote helpers, strategies, collections, embedding models (remote)
 * 
 * @param {Object|null} remoteConfig - Config fetched from LLM service
 * @returns {Object} Aggregated configuration for frontend
 */
const aggregateConfig = (remoteConfig) => {
    const { strategies, helpers } = localConfig;
    const { classes, categories, presets } = pictureClassificationsConfig;

    // Local strategies and helpers (executed in frontend)
    const localStrategies = strategies.localStrategies || [];
    const localHelpers = helpers.localHelpers || [];

    // Remote strategies, helpers, collections, embedding models (from LLM service)
    const remoteStrategies = remoteConfig?.strategies || [];
    const remoteHelpers = remoteConfig?.helpers || [];
    const collections = remoteConfig?.collections || [];
    const embeddingModels = remoteConfig?.embeddingModels || [];

    // Combine local and remote
    const allStrategies = [...localStrategies, ...remoteStrategies];
    const allHelpers = [...localHelpers, ...remoteHelpers];

    return {
        // Embedding strategies - how to chunk documents for embedding
        strategies: allStrategies,

        // Helper functions - document manipulation
        helpers: allHelpers,

        // Target vector databases (from LLM service)
        collections: collections,

        // Embedding models (from LLM service)
        embeddingModels: embeddingModels,

        // Picture classification - all 26 Docling classes (local)
        imageClasses: classes,

        // Picture categories for UI grouping (local)
        imageCategories: categories,

        // Picture presets for batch operations (local)
        imagePresets: presets,

        // Legacy aliases for backward compatibility
        availableTargetDbs: collections,
        availableImageClasses: classes,
    };
};

/**
 * Create a new ChromaDB collection
 * 
 * Proxies to LLM service /api/ingestion/collection endpoint.
 * 
 * @param {string} name - Collection name (sanitized)
 * @param {string} [description] - Optional description
 * @returns {Promise<Object>} - Result with success status and collection info
 */
const createCollection = async (name, description) => {
    console.log(`[COLLECTION] Creating collection: ${name}`);

    try {
        const response = await axios.post(
            `${LLM_SERVICE_URL}/api/ingestion/collection`,
            { name, description },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000, // 30 second timeout
            }
        );

        console.log(`[COLLECTION] LLM service response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        console.error(`[COLLECTION] Error creating collection:`, error.message);

        // Check if it's a response error (e.g., 409 conflict for existing collection)
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 409) {
                return {
                    success: false,
                    error: 'Collection already exists',
                    details: data?.details || `A collection with name "${name}" already exists`,
                };
            }

            return {
                success: false,
                error: data?.error || `LLM service error (${status})`,
                details: data?.details || error.message,
            };
        }

        // Network error or timeout
        throw new Error(`Failed to connect to LLM service: ${error.message}`);
    }
};

// ============================================================================
// DOCUMENT UPLOAD (Proxy to LLM Service)
// ============================================================================

/**
 * Upload a file for processing (content extraction)
 * 
 * Proxies to LLM service /api/ingestion/convert endpoint.
 * Returns extracted content with pages, text items, images, and tables.
 * 
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<Object>} - Extracted content with pages/items
 */
const uploadForProcessing = async (fileBuffer, filename, mimeType) => {
    console.log(`[UPLOAD] Processing document: ${filename} (${mimeType}, ${fileBuffer.length} bytes)`);

    const formData = new FormData();
    formData.append('file', fileBuffer, {
        filename,
        contentType: mimeType
    });

    try {
        console.log(`[UPLOAD] Calling LLM service: ${LLM_SERVICE_URL}/api/ingestion/convert`);
        const response = await axios.post(
            `${LLM_SERVICE_URL}/api/ingestion/convert`,
            formData,
            {
                headers: { ...formData.getHeaders() },
                timeout: 120000, // 2 minute timeout for PDF processing
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );

        console.log(`[UPLOAD] LLM service response received: success=${response.data?.success}`);

        // Validate response structure
        if (!response.data?.success) {
            throw new Error(response.data?.error || 'LLM service returned unsuccessful response');
        }

        if (!response.data?.content) {
            throw new Error('LLM service response missing content field');
        }

        // Return the content from LLM service
        return response.data.content;

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[UPLOAD] LLM service unavailable at ${LLM_SERVICE_URL}`);
            throw new Error(`LLM service unavailable. Please ensure it is running at ${LLM_SERVICE_URL}`);
        }

        if (error.response) {
            // LLM service returned an error response
            console.error(`[UPLOAD] LLM service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data?.detail || error.response.data?.error || 'LLM service processing failed');
        }

        console.error(`[UPLOAD] Upload error: ${error.message}`);
        throw error;
    }
};

// ============================================================================
// VECTOR DB INGESTION (Proxy to LLM Service)
// ============================================================================

/**
 * Ingest pre-transformed documents into vector database
 * 
 * Receives documents array directly from frontend (already transformed by preview).
 * Simply proxies to LLM service.
 * 
 * @param {string} targetDb - Target database ID (collection ID)
 * @param {Array} documents - Pre-transformed documents array with id, content, metadata
 * @param {string} strategy - Embedding strategy used
 * @param {string} source - Source filename for logging
 * @returns {Promise<Object>} - Ingestion result
 */
const ingestToVectorDb = async (targetDb, documents, strategy = 'embed_per_page', source = 'unknown') => {
    console.log(`[INGEST] Received ${documents.length} pre-transformed documents`);
    console.log(`[INGEST] Strategy: ${strategy}, Target: ${targetDb}, Source: ${source}`);

    try {
        console.log(`[INGEST] Calling LLM service: ${LLM_SERVICE_URL}/api/ingestion/ingest`);
        const response = await axios.post(
            `${LLM_SERVICE_URL}/api/ingestion/ingest`,
            {
                collectionId: targetDb,
                documents: documents,
                strategy: strategy,
            },
            { timeout: 120000 } // 2 minute timeout for ingestion
        );

        console.log(`[INGEST] LLM service response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[INGEST] LLM service unavailable at ${LLM_SERVICE_URL}`);
            // Fall back to mock for development
            console.log(`[INGEST] Falling back to mock response`);
            return {
                success: true,
                collectionId: targetDb,
                strategy,
                documentCount: documents.length,
                message: `[MOCK] Successfully ingested ${documents.length} documents to ${targetDb} (LLM service unavailable)`,
            };
        }

        if (error.response) {
            console.error(`[INGEST] LLM service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data?.detail || error.response.data?.error || 'LLM service ingestion failed');
        }

        console.error(`[INGEST] Ingestion error: ${error.message}`);
        throw error;
    }
};

// ============================================================================
// MOCK DATA (Development)
// ============================================================================

/**
 * Generate mock content for development when LLM service is unavailable
 */
const generateMockContent = (filename) => {
    return {
        filename,
        totalPages: 3,
        pages: [
            {
                pageNumber: 1,
                items: [
                    {
                        id: 't1',
                        type: 'text',
                        content: '# Chapter 1: Introduction\n\nThis document provides comprehensive guidance for employees at TUM Klinikum regarding the ATOSS Workforce Management System.',
                        deleted: false,
                    },
                    {
                        id: 'i1',
                        type: 'image',
                        imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiMwMDY1YmQiLz48dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxPR088L3RleHQ+PC9zdmc+',
                        imageWidth: 100,
                        imageHeight: 50,
                        classification: 'logo',
                        deleted: false,
                    },
                    {
                        id: 't2',
                        type: 'text',
                        content: '## Overview\n\nThe **workforce management** system helps with:\n- Time tracking\n- Shift scheduling\n- Leave management\n- Compliance reporting',
                        deleted: false,
                    },
                ],
            },
            {
                pageNumber: 2,
                items: [
                    {
                        id: 't3',
                        type: 'text',
                        content: '### Section 1.1: Getting Started\n\nKey points to remember:\n- Always log in with your employee ID\n- Check your schedule daily\n- Report absences in advance',
                        deleted: false,
                    },
                    {
                        id: 'i2',
                        type: 'image',
                        imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2YwZjBmMCIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMwMDY1YmQiIHJ4PSI1Ii8+PHJlY3QgeD0iMzAwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiM2NGEwZDAiIHJ4PSI1Ii8+PGxpbmUgeDE9IjE1MCIgeTE9IjE1MCIgeDI9IjQwMCIgeTI9IjEwMCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIzMDAiIHk9IjI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Xb3JrZmxvdyBEaWFncmFtPC90ZXh0Pjwvc3ZnPg==',
                        imageWidth: 600,
                        imageHeight: 400,
                        classification: 'diagram',
                        deleted: false,
                    },
                    {
                        id: 'tb1',
                        type: 'table',
                        tableData: {
                            headers: ['Role', 'Access Level', 'Permissions'],
                            rows: [
                                ['Admin', 'Full', 'All features'],
                                ['Manager', 'Department', 'Team schedules, approvals'],
                                ['Employee', 'Personal', 'View schedule, request leave'],
                            ],
                        },
                        deleted: false,
                    },
                ],
            },
            {
                pageNumber: 3,
                items: [
                    {
                        id: 't4',
                        type: 'text',
                        content: '## Conclusion\n\nFor more information, contact the IT support team or visit the internal help portal.',
                        deleted: false,
                    },
                    {
                        id: 'i3',
                        type: 'image',
                        imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2ZmZiIvPjxsaW5lIHgxPSI1MCIgeTE9IjI1MCIgeDI9IjQ1MCIgeTI9IjI1MCIgc3Ryb2tlPSIjY2NjIi8+PGxpbmUgeDE9IjUwIiB5MT0iNTAiIHgyPSI1MCIgeTI9IjI1MCIgc3Ryb2tlPSIjY2NjIi8+PHBvbHlsaW5lIHBvaW50cz0iNTAsMjAwIDEyNSwxNTAgMjAwLDE4MCAyNzUsMTAwIDM1MCwxMjAgNDI1LDYwIiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDY1YmQiIHN0cm9rZS13aWR0aD0iMyIvPjx0ZXh0IHg9IjI1MCIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMzMzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBlcmZvcm1hbmNlIENoYXJ0PC90ZXh0Pjwvc3ZnPg==',
                        imageWidth: 500,
                        imageHeight: 300,
                        classification: 'chart',
                        deleted: false,
                    },
                ],
            },
        ],
    };
};

module.exports = {
    // Configuration
    getConfig,
    createCollection,
    // Proxy to LLM Service
    uploadForProcessing,
    ingestToVectorDb,
    // Mock (for development)
    generateMockContent,
};
