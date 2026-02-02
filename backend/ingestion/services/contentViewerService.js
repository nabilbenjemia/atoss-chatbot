const axios = require('axios');

/**
 * Content Viewer Service
 * 
 * Component-level operations for ContentViewer and related components.
 * Handles AI helpers, content transformations, and item operations.
 * 
 * NOTE: Currently returns MOCK DATA. LLM service AI helpers not implemented.
 * When LLM service is ready, uncomment the actual API calls.
 */

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

// ============================================================================
// AI HELPERS (Backend-powered)
// ============================================================================

/**
 * Run AI helper function on document content
 * 
 * NOTE: Currently returns MOCK DATA. LLM service /api/helper/* not implemented.
 * 
 * @param {string} helperId - Helper function ID
 * @param {Object} content - Document content
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} - Helper result with modifiedItems
 */
const runAiHelper = async (helperId, content, params = {}) => {
    // TODO: When LLM service is ready, uncomment this:
    // try {
    //     const response = await axios.post(
    //         `${LLM_SERVICE_URL}/api/helper/${helperId}`,
    //         { content, params },
    //         { timeout: 30000 }
    //     );
    //     return response.data;
    // } catch (error) {
    //     console.error('LLM service helper error:', error.message);
    //     if (helperId === 'ai_image_descriptions') {
    //         return generateMockImageDescriptions(content);
    //     }
    //     throw error;
    // }

    // For now, return mock response directly
    console.log(`[MOCK] Running mock AI helper: ${helperId} (LLM service not implemented)`);

    if (helperId === 'ai_image_descriptions') {
        return generateMockImageDescriptions(content);
    }

    // Generic mock response for unknown helpers
    return {
        success: false,
        error: `Helper '${helperId}' not implemented (LLM service not available)`,
        modifiedItems: [],
    };
};

/**
 * Generate AI descriptions for specific images
 * Calls LLM service vision model endpoint to generate descriptions
 * 
 * @param {string} documentId - Document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @returns {Promise<Object>} - { success, descriptions: [{ imageId, description }], message }
 */
const generateImageDescriptionsFromImages = async (documentId, images) => {
    console.log(`[IMAGE-DESCRIPTIONS] Generating descriptions for ${images.length} images in document: ${documentId}`);

    try {
        const response = await axios.post(
            `${LLM_SERVICE_URL}/api/ingestion/helper/ai_image_descriptions`,
            { documentId, images },
            { timeout: 120000 } // 2 minute timeout for AI processing (images take time)
        );

        console.log(`[IMAGE-DESCRIPTIONS] LLM service response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        console.error('[IMAGE-DESCRIPTIONS] LLM service error:', error.message);

        // Fall back to mock if LLM service is unavailable
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('[IMAGE-DESCRIPTIONS] Falling back to mock descriptions');
            return generateMockImageDescriptionsFromImages(documentId, images);
        }

        // For other errors, return error response
        if (error.response) {
            return {
                success: false,
                descriptions: [],
                message: error.response.data?.detail || 'LLM service error',
            };
        }

        throw error;
    }
};

/**
 * Stream AI descriptions for specific images (SSE)
 * Proxies SSE from LLM service to frontend, sending each description immediately
 * 
 * @param {string} documentId - Document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @param {Response} res - Express response object for streaming
 */
const streamImageDescriptions = async (documentId, images, res) => {
    console.log(`[IMAGE-DESCRIPTIONS-STREAM] Streaming descriptions for ${images.length} images in document: ${documentId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        // Make POST request to LLM service streaming endpoint
        const response = await axios({
            method: 'POST',
            url: `${LLM_SERVICE_URL}/api/ingestion/helper/ai_image_descriptions/stream`,
            data: { documentId, images },
            responseType: 'stream',
            timeout: 300000, // 5 minute timeout for streaming
        });

        // Pipe the SSE stream from LLM service to frontend
        response.data.on('data', (chunk) => {
            const data = chunk.toString();
            res.write(data);
        });

        response.data.on('end', () => {
            console.log('[IMAGE-DESCRIPTIONS-STREAM] Stream completed');
            res.end();
        });

        response.data.on('error', (error) => {
            console.error('[IMAGE-DESCRIPTIONS-STREAM] Stream error:', error.message);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('[IMAGE-DESCRIPTIONS-STREAM] LLM service error:', error.message);

        // Fall back to mock if LLM service is unavailable
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('[IMAGE-DESCRIPTIONS-STREAM] Falling back to mock streaming');
            await streamMockImageDescriptions(documentId, images, res);
            return;
        }

        // Send error event
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
};

/**
 * Stream mock image descriptions (for fallback/development)
 */
const streamMockImageDescriptions = async (documentId, images, res) => {
    // Send start event
    res.write(`data: ${JSON.stringify({ type: 'start', total: images.length, documentId })}\n\n`);

    // Stream each mock description with small delay
    for (const img of images) {
        const classification = img.classification || 'unclassified';
        const mockDescriptions = {
            'logo': 'This is a company logo representing the brand identity.',
            'icon': 'This is a small icon used for visual emphasis.',
            'screenshot_from_computer': 'This is a screenshot showing a software interface.',
            'flow_chart': 'This is a flow chart illustrating a process workflow.',
            'bar_chart': 'This is a bar chart presenting data comparison.',
        };

        const description = mockDescriptions[classification] || `[Mock] Image of type: ${classification}`;

        res.write(`data: ${JSON.stringify({
            type: 'description',
            imageId: img.id,
            classification,
            description: `${description} (Mock - vision model unavailable)`,
        })}\n\n`);

        // Small delay between mock responses
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send done event
    res.write(`data: ${JSON.stringify({ type: 'done', success: images.length, total: images.length })}\n\n`);
    res.end();
};

// ============================================================================
// MOCK DATA (Development)
// ============================================================================

/**
 * Generate mock AI image descriptions for development
 */
const generateMockImageDescriptions = (content) => {
    const modifiedItems = [];

    if (content?.pages) {
        for (const page of content.pages) {
            for (const item of page.items || []) {
                if (item.type === 'image' && !item.deleted) {
                    modifiedItems.push({
                        id: item.id,
                        description: `AI-generated description for ${item.classification || 'image'} on page ${page.pageNumber}`
                    });
                }
            }
        }
    }

    return {
        success: true,
        modifiedItems,
        message: `Generated descriptions for ${modifiedItems.length} images`
    };
};

/**
 * Get classification-specific prompt for image description
 * Different prompts for different image types to get better AI descriptions
 * @param {string} classification - Image classification
 * @returns {string} - Description prompt tailored to the classification
 */
const getPromptForClassification = (classification) => {
    const prompts = {
        logo: 'This appears to be a company or brand logo.',
        figure: 'This is a figure or illustration that visualizes concepts from the document.',
        chart: 'This is a chart or graph presenting data. It likely shows trends, comparisons, or distributions.',
        diagram: 'This is a diagram illustrating a process, structure, or relationship between components.',
        photo: 'This is a photograph capturing a real-world scene or subject.',
        screenshot: 'This is a screenshot showing a user interface or application window.',
        table_image: 'This is an image of a table containing structured data.',
        other: 'This is a visual element that provides context to the document content.',
        unclassified: 'This is a visual element found in the document.',
    };
    return prompts[classification] || prompts.unclassified;
};

/**
 * Generate mock AI image descriptions from images array (new endpoint)
 * Classification-aware: generates different descriptions based on image type
 * @param {string} documentId - Document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @returns {Object} - { success, descriptions: [{ imageId, description }], message }
 */
const generateMockImageDescriptionsFromImages = (documentId, images) => {
    const descriptions = images.map((img) => {
        const classificationHint = getPromptForClassification(img.classification);
        return {
            imageId: img.id,
            classification: img.classification || 'unclassified',
            description: `${classificationHint} Found on page ${img.pageNumber}. [Mock description - replace with actual AI vision model output]`,
        };
    });

    // Group by classification for logging
    const classificationCounts = {};
    images.forEach(img => {
        const cls = img.classification || 'unclassified';
        classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;
    });
    console.log(`[MOCK] Image classifications:`, classificationCounts);

    return {
        success: true,
        descriptions,
        message: `Generated descriptions for ${descriptions.length} image(s)`,
    };
};

module.exports = {
    // AI Helpers
    runAiHelper,
    generateImageDescriptionsFromImages,
    streamImageDescriptions,
};
