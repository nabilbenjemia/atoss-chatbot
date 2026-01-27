const ingestionService = require('../services/ingestionService');
const contentViewerService = require('../services/contentViewerService');

/**
 * Ingestion Controller
 * 
 * Handles HTTP requests for document ingestion operations.
 * All document state is managed by the frontend (localStorage).
 * This controller only provides processing/AI functionality.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GET /api/ingestion/config
 * Get backend configuration (target DBs, image classes, etc.)
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
// DOCUMENT UPLOAD & PROCESSING
// ============================================================================

/**
 * POST /api/ingestion/upload
 * Upload a document for content extraction
 * 
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
 * Receives document state from frontend, returns preview of embeddings.
 */
const previewEmbeddings = async (req, res) => {
    try {
        const { documentState, strategy = 'embed_per_page' } = req.body;

        if (!documentState) {
            return res.status(400).json({ error: 'documentState is required' });
        }

        // Generate preview based on strategy
        const preview = ingestionService.generateEmbeddingPreview(documentState, strategy);
        res.json(preview);
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview', details: error.message });
    }
};

/**
 * POST /api/ingestion/ingest
 * Ingest content into vector database
 * 
 * Receives document state from frontend, ingests into target DB.
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
// AI HELPERS (ContentViewer)
// ============================================================================

/**
 * POST /api/ingestion/helper
 * Run a backend AI helper function
 * 
 * Receives document content from frontend, processes with AI, returns results.
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

        // Run helper via content viewer service
        const result = await contentViewerService.runAiHelper(helperId, content, params);
        res.json(result);
    } catch (error) {
        console.error('Helper error:', error);
        res.status(500).json({ error: 'Failed to run helper', details: error.message });
    }
};

module.exports = {
    getConfig,
    uploadDocument,
    previewEmbeddings,
    startIngestion,
    runHelper,
};
