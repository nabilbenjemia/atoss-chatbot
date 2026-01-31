const ingestionService = require('../services/ingestionService');
const contentViewerService = require('../services/contentViewerService');

/**
 * Ingestion Controller
 * 
 * Handles HTTP requests for document ingestion operations.
 * 
 * Architecture:
 * - All document state is managed by frontend (localStorage)
 * - Local strategies/helpers are executed in frontend
 * - This controller proxies to LLM service for remote operations
 * - Configuration is aggregated from local config + LLM service
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GET /api/ingestion/config
 * Get backend configuration (strategies, helpers, collections, image classes)
 * 
 * Aggregates local config (localConfig.json) with remote config from LLM service.
 */
const getConfig = async (req, res) => {
    try {
        const config = await ingestionService.getConfig();
        res.json(config);
    } catch (error) {
        console.error('Config error:', error);
        res.status(500).json({ error: 'Failed to get config', details: error.message });
    }
};

// ============================================================================
// DOCUMENT UPLOAD & PROCESSING (Proxy to LLM Service)
// ============================================================================

/**
 * POST /api/ingestion/upload
 * Upload a document for content extraction
 * 
 * Proxies to LLM service /api/docling/process.
 * Returns extracted content immediately (no server-side state).
 * Frontend caches the result in localStorage.
 */
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { originalname, mimetype, buffer } = req.file;

        // Process document through LLM service
        const content = await ingestionService.uploadForProcessing(buffer, originalname, mimetype);

        // Return extracted content directly
        // Frontend will cache this in localStorage
        res.status(200).json({
            success: true,
            filename: originalname,
            content: {
                documentId: `doc_${Date.now()}`, // Generate a client-side ID
                filename: content.filename || originalname,
                totalPages: content.totalPages || content.pages?.length || 0,
                pages: content.pages || []
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process document', details: error.message });
    }
};

// ============================================================================
// EMBEDDING PREVIEW & INGESTION
// ============================================================================

/**
 * POST /api/ingestion/preview
 * Generate embedding preview from document content
 * 
 * NOTE: For local strategies (embed_per_page, chunked_fixed), this should be
 * handled in the FRONTEND. This endpoint is kept for remote/AI strategies
 * that require server-side processing.
 * 
 * TODO: Frontend should implement local preview generation and only call
 * this endpoint for remote strategies.
 */
const previewEmbeddings = async (req, res) => {
    try {
        const { documentState, strategy = 'embed_per_page' } = req.body;

        if (!documentState) {
            return res.status(400).json({ success: false, error: 'documentState is required' });
        }

        // For now, return a message indicating frontend should handle local strategies
        // TODO: Implement remote strategy preview via LLM service
        res.json({
            success: true,
            message: 'Preview should be generated in frontend for local strategies',
            preview: {
                source: documentState.filename || 'unknown',
                document_type: 'pdf',
                page_count: documentState.pages?.length || 0,
                total_embeddings: 0,
                strategy: strategy,
                documents: [],
            }
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview', details: error.message });
    }
};

/**
 * POST /api/ingestion/ingest
 * Ingest content into vector database
 * 
 * Proxies to LLM service /api/ingestion/ingest.
 * Receives pre-processed document state from frontend.
 */
const startIngestion = async (req, res) => {
    try {
        const { targetDb, documentState, strategy = 'embed_per_page' } = req.body;

        if (!targetDb) {
            return res.status(400).json({ error: 'targetDb is required' });
        }

        if (!documentState) {
            return res.status(400).json({ error: 'documentState is required' });
        }

        // Ingest to vector database via LLM service
        const result = await ingestionService.ingestToVectorDb(targetDb, documentState, strategy);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Ingestion error:', error);
        res.status(500).json({ error: 'Failed to ingest content', details: error.message });
    }
};

// ============================================================================
// AI HELPERS (Proxy to LLM Service)
// ============================================================================

/**
 * POST /api/ingestion/helper
 * Run a backend AI helper function
 * 
 * NOTE: Local helpers (remove_logos, remove_decorative, etc.) are executed
 * in the FRONTEND. This endpoint is for remote AI helpers only.
 */
const runHelper = async (req, res) => {
    try {
        const { helperId, content, params = {} } = req.body;

        if (!helperId) {
            return res.status(400).json({ error: 'helperId is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Run helper via content viewer service (proxies to LLM service)
        const result = await contentViewerService.runAiHelper(helperId, content, params);
        res.json(result);
    } catch (error) {
        console.error('Helper error:', error);
        res.status(500).json({ error: 'Failed to run helper', details: error.message });
    }
};

/**
 * POST /api/ingestion/helper/image-descriptions
 * Generate AI descriptions for images
 * 
 * Proxies to LLM service for AI vision processing.
 */
const generateImageDescriptions = async (req, res) => {
    try {
        const { documentId, images } = req.body;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'documentId is required' });
        }

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, error: 'images array is required' });
        }

        // Generate descriptions via content viewer service (proxies to LLM service)
        const result = await contentViewerService.generateImageDescriptionsFromImages(documentId, images);
        res.json(result);
    } catch (error) {
        console.error('Image descriptions error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate image descriptions', details: error.message });
    }
};

module.exports = {
    getConfig,
    uploadDocument,
    previewEmbeddings,
    startIngestion,
    runHelper,
    generateImageDescriptions,
};
