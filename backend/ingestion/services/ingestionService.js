/**
 * Ingestion Service
 * 
 * Page-level operations for the IngestionPage.
 * Handles document upload, configuration, and vector DB ingestion.
 * 
 * NOTE: Currently returns MOCK DATA. LLM service integration not yet implemented.
 * When LLM service is ready, uncomment the actual API calls.
 */

const axios = require('axios');
const FormData = require('form-data');

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get backend configuration
 * 
 * ADR-001: Returns metadata that controls frontend behavior.
 * Currently returns mock data. Will call LLM service when implemented.
 * 
 * @returns {Promise<Object>} Configuration with strategies, helpers, collections
 */
const getConfig = async () => {
    // TODO: When LLM service is ready, uncomment this:
    // try {
    //     const response = await axios.get(`${LLM_SERVICE_URL}/api/config`);
    //     return response.data;
    // } catch (error) {
    //     console.error('LLM service config error:', error.message);
    //     return getDefaultConfig();
    // }

    // For now, return mock config directly
    console.log('[MOCK] Returning mock configuration (LLM service not implemented)');
    return getDefaultConfig();
};

/**
 * Default configuration when LLM service is unavailable
 * 
 * ADR-001: Hybrid Approach - Backend provides metadata/control, frontend provides local execution code.
 * This config controls which strategies/helpers are visible and enabled in the frontend.
 * Local strategies/helpers have their implementation code in the frontend bundle.
 * Backend strategies/helpers call back to this service (which will proxy to LLM service).
 */
const getDefaultConfig = () => {
    return {
        // Embedding strategies - how to chunk documents for embedding
        // Type 'local' = frontend executes, 'backend' = calls API
        strategies: [
            { id: 'embed_per_page', label: 'One Embedding per Page', type: 'local', enabled: true },
            { id: 'chunked_fixed', label: 'Fixed-Size Chunks', type: 'local', enabled: true },
            { id: 'semantic_sections', label: 'Semantic Sections (AI)', type: 'backend', enabled: false }, // Not implemented yet
            { id: 'hierarchical', label: 'Hierarchical (AI)', type: 'backend', enabled: false }, // Not implemented yet
        ],
        // Helper functions - document manipulation
        // Type 'local' = frontend executes, 'backend' = calls API
        helpers: [
            { id: 'remove_logos', label: 'Remove All Logos', type: 'local', enabled: true },
            { id: 'remove_empty', label: 'Remove Empty Text', type: 'local', enabled: true },
            { id: 'delete_regex', label: 'Delete by Regex', type: 'local', enabled: true, hasInput: true },
            { id: 'ai_image_descriptions', label: 'AI Image Descriptions', type: 'backend', enabled: false }, // Not implemented yet
        ],
        // Target vector databases (always from backend)
        collections: [
            { id: 'chroma_default', label: 'ChromaDB (Default)' },
            { id: 'chroma_snowflake', label: 'ChromaDB (Snowflake Collection)' },
        ],
        // Image classification options
        imageClasses: [
            'logo',
            'figure',
            'chart',
            'diagram',
            'photo',
            'screenshot',
            'table_image',
            'other',
        ],
        // Embedding models (for display/selection)
        embeddingModels: [
            { id: 'default', label: 'Snowflake Arctic Embed', disabled: false },
            { id: 'openai', label: 'OpenAI Ada-002', disabled: true },
        ],
        // Legacy aliases for backward compatibility
        availableTargetDbs: [
            { id: 'chroma_default', label: 'ChromaDB (Default)' },
            { id: 'chroma_snowflake', label: 'ChromaDB (Snowflake Collection)' },
        ],
        availableImageClasses: [
            'logo',
            'figure',
            'chart',
            'diagram',
            'photo',
            'screenshot',
            'table_image',
            'other',
        ],
    };
};

// ============================================================================
// DOCUMENT UPLOAD
// ============================================================================

/**
 * Upload a file for processing (content extraction)
 * 
 * NOTE: Currently returns MOCK DATA. LLM service /api/docling/process not implemented.
 * 
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<Object>} - Extracted content with pages/items
 */
const uploadForProcessing = async (fileBuffer, filename, mimeType) => {
    // TODO: When LLM service is ready, uncomment this:
    // const formData = new FormData();
    // formData.append('file', fileBuffer, {
    //     filename,
    //     contentType: mimeType
    // });
    // 
    // try {
    //     const response = await axios.post(
    //         `${LLM_SERVICE_URL}/api/docling/process`,
    //         formData,
    //         {
    //             headers: {
    //                 ...formData.getHeaders()
    //             },
    //             timeout: 60000 // 60 second timeout for processing
    //         }
    //     );
    //     return response.data;
    // } catch (error) {
    //     console.error('LLM service upload error:', error.message);
    //     return generateMockContent(filename);
    // }

    // For now, return mock content directly
    console.log(`[MOCK] Returning mock content for: ${filename} (LLM service not implemented)`);
    return generateMockContent(filename);
};

// ============================================================================
// VECTOR DB INGESTION
// ============================================================================

/**
 * Ingest content into vector database
 * 
 * NOTE: Currently returns MOCK DATA. LLM service /api/ingest not implemented.
 * 
 * @param {string} targetDb - Target database ID
 * @param {Object} documentState - Document content to ingest
 * @param {string} strategy - Embedding strategy ('embed_per_page' | 'chunked_document')
 * @returns {Promise<Object>} - Ingestion result
 */
const ingestToVectorDb = async (targetDb, documentState, strategy = 'embed_per_page') => {
    // TODO: When LLM service is ready, uncomment this:
    // try {
    //     const response = await axios.post(
    //         `${LLM_SERVICE_URL}/api/ingest`,
    //         { targetDb, content: documentState, strategy },
    //         { timeout: 120000 } // 2 minute timeout for ingestion
    //     );
    //     return response.data;
    // } catch (error) {
    //     console.error('LLM service ingest error:', error.message);
    //     throw error;
    // }

    // For now, return mock success
    const preview = generateEmbeddingPreview(documentState, strategy);
    console.log(`[MOCK] Mock ingestion to ${targetDb}: ${preview.total_embeddings} chunks (LLM service not implemented)`);

    return {
        success: true,
        targetDb,
        strategy,
        documentCount: preview.total_embeddings,
        message: `[MOCK] Successfully ingested ${preview.total_embeddings} embeddings to ${targetDb}`,
    };
};

/**
 * Generate embedding preview from document content
 * @param {Object} documentState - Current document state with pages
 * @param {string} strategy - Embedding strategy
 * @returns {Object} - Preview of what will be embedded
 */
const generateEmbeddingPreview = (documentState, strategy) => {
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
    } else if (strategy === 'chunked_document') {
        // Semantic chunking: merge all content and split into chunks
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
    getDefaultConfig,
    // Upload
    uploadForProcessing,
    // Ingestion
    ingestToVectorDb,
    generateEmbeddingPreview,
    // Mock (for development)
    generateMockContent,
};
