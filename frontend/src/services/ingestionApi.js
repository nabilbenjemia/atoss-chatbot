/**
 * Ingestion API Service
 * 
 * All API calls for the document ingestion feature.
 * Currently mocked with realistic delays for development.
 * 
 * IMPORTANT: Every function has a // TODO: Connect to backend marker
 * for easy identification of integration points.
 */

import {
    mockBackendConfig,
    mockExtractedContent,
    delay,
    generateId,
    generateMockEmbeddingPreview,
} from '../mocks/ingestionMocks';
import { INGESTION_CONFIG } from '../config/ingestionConfig';

// Track mock processing state
const processingDocuments = new Map();
const ingestionJobs = new Map();

/**
 * Upload a document for processing
 * @param {File} file - The file to upload
 * @param {Object} config - Optional processing configuration
 * @returns {Promise<{documentId: string, status: string, estimatedTime: number}>}
 */
// TODO: Connect to backend - POST /api/ingestion/upload
export const uploadDocument = async (file, config = {}) => {
    // Config will be used when connecting to real backend
    void config; // Prevents unused variable warning

    // Simulate upload delay based on file size
    const uploadTime = Math.min(2000, file.size / 10000);
    await delay(uploadTime);

    const documentId = generateId();

    // Store in mock processing state
    processingDocuments.set(documentId, {
        status: 'processing',
        progress: 0,
        filename: file.name,
        startTime: Date.now(),
    });

    // Simulate processing in background
    simulateProcessing(documentId);

    return {
        documentId,
        status: 'processing',
        estimatedTime: 5000,
    };
};

// Simulate document processing
const simulateProcessing = async (documentId) => {
    const steps = [10, 25, 45, 60, 75, 90, 100];

    for (const progress of steps) {
        await delay(INGESTION_CONFIG.polling.processingStatusMs / 2);

        const doc = processingDocuments.get(documentId);
        if (doc) {
            doc.progress = progress;
            if (progress === 100) {
                doc.status = 'ready';
            }
            processingDocuments.set(documentId, doc);
        }
    }
};

/**
 * Get the processing status of a document
 * @param {string} documentId - The document ID
 * @returns {Promise<{status: string, progress: number, error?: string}>}
 */
// TODO: Connect to backend - GET /api/ingestion/{documentId}/status
export const getProcessingStatus = async (documentId) => {
    await delay(200); // Small delay to simulate network

    const doc = processingDocuments.get(documentId);

    if (!doc) {
        // Return ready for mock document
        return {
            status: 'ready',
            progress: 100,
        };
    }

    return {
        status: doc.status,
        progress: doc.progress,
        error: doc.error,
    };
};

/**
 * Get the extracted content of a processed document
 * @param {string} documentId - The document ID
 * @returns {Promise<Object>} - The extracted content with pages
 */
// TODO: Connect to backend - GET /api/ingestion/{documentId}/content
export const getExtractedContent = async (documentId) => {
    await delay(500); // Simulate network delay

    // Return mock content with the provided documentId
    return {
        ...mockExtractedContent,
        documentId,
    };
};

/**
 * Get backend configuration (available DBs, image classes, etc.)
 * @returns {Promise<Object>} - The backend configuration
 */
// TODO: Connect to backend - GET /api/ingestion/config
export const getBackendConfig = async () => {
    await delay(300); // Simulate network delay

    return mockBackendConfig;
};

/**
 * Run a backend helper function
 * @param {string} documentId - The document ID
 * @param {string} helperId - The helper function ID
 * @param {Object} params - Optional parameters for the helper
 * @returns {Promise<{success: boolean, modifiedItems: Array, message?: string}>}
 */
// TODO: Connect to backend - POST /api/ingestion/{documentId}/helper
export const runBackendHelper = async (documentId, helperId, params = {}) => {
    // Params will be used when connecting to real backend
    void documentId; void params;

    await delay(1500); // Simulate AI processing time

    // Mock response based on helper type
    switch (helperId) {
        case 'ai_image_descriptions':
            return {
                success: true,
                modifiedItems: [
                    {
                        id: 'i1',
                        description: 'Company logo in blue and white colors',
                    },
                    {
                        id: 'i2',
                        description: 'Workflow diagram showing system architecture',
                    },
                    {
                        id: 'i3',
                        description: 'Performance metrics chart showing upward trend',
                    },
                ],
                message: 'Generated descriptions for 3 images',
            };
        default:
            return {
                success: true,
                modifiedItems: [],
                message: 'Helper executed successfully',
            };
    }
};

/**
 * Start ingestion of a document into a vector database
 * @param {string} documentId - The document ID
 * @param {string} targetDb - The target database ID
 * @param {Object} content - The content to ingest (with modifications)
 * @returns {Promise<{jobId: string, status: string}>}
 */
// TODO: Connect to backend - POST /api/ingestion/{documentId}/ingest
export const startIngestion = async (documentId, targetDb, content) => {
    // Content will be sent to backend when connected
    void documentId; void targetDb; void content;

    await delay(500); // Simulate network delay

    const jobId = generateId();

    // Store in mock ingestion state
    ingestionJobs.set(jobId, {
        status: 'running',
        progress: 0,
        documentId,
        targetDb,
        startTime: Date.now(),
    });

    // Simulate ingestion in background
    simulateIngestion(jobId);

    return {
        jobId,
        status: 'started',
    };
};

// Simulate ingestion process
const simulateIngestion = async (jobId) => {
    const steps = [20, 40, 60, 80, 100];

    for (const progress of steps) {
        await delay(INGESTION_CONFIG.polling.ingestionStatusMs / 2);

        const job = ingestionJobs.get(jobId);
        if (job) {
            job.progress = progress;
            if (progress === 100) {
                job.status = 'completed';
            }
            ingestionJobs.set(jobId, job);
        }
    }
};

/**
 * Get the status of an ingestion job
 * @param {string} jobId - The job ID
 * @returns {Promise<{status: string, progress: number, error?: string}>}
 */
// TODO: Connect to backend - GET /api/ingestion/job/{jobId}/status
export const getIngestionStatus = async (jobId) => {
    await delay(200); // Small delay to simulate network

    const job = ingestionJobs.get(jobId);

    if (!job) {
        return {
            status: 'completed',
            progress: 100,
        };
    }

    return {
        status: job.status,
        progress: job.progress,
        error: job.error,
    };
};

/**
 * Cancel a processing or ingestion job
 * @param {string} id - The document or job ID
 * @returns {Promise<{success: boolean}>}
 */
// TODO: Connect to backend - DELETE /api/ingestion/{id}
export const cancelJob = async (id) => {
    await delay(200);

    processingDocuments.delete(id);
    ingestionJobs.delete(id);

    return { success: true };
};

/**
 * Preview embeddings that will be created from a document
 * @param {string} documentId - The document ID
 * @param {string} strategy - The ingestion strategy (embed_per_page, chunked_document, etc.)
 * @param {Object} documentState - The current document state with pages
 * @returns {Promise<Object>} - Preview of embeddings to be created
 */
// TODO: Connect to backend - POST /api/ingestion/{documentId}/preview
export const previewEmbeddings = async (documentId, strategy, documentState) => {
    // documentId will be used when connecting to real backend
    void documentId;

    await delay(800); // Simulate processing time

    // Generate preview from current document state
    const preview = generateMockEmbeddingPreview(documentState, strategy);

    return preview;
};

// Export all functions as named exports
export default {
    uploadDocument,
    getProcessingStatus,
    getExtractedContent,
    getBackendConfig,
    runBackendHelper,
    startIngestion,
    getIngestionStatus,
    cancelJob,
    previewEmbeddings,
};
