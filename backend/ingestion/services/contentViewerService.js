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
 * Generate AI descriptions for images in document
 * @param {Object} content - Document content with pages/items
 */
const generateImageDescriptions = async (content) => {
    return runAiHelper('ai_image_descriptions', content);
};

/**
 * Generate AI descriptions for specific images
 * New endpoint that receives images directly from frontend
 * 
 * @param {string} documentId - Document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @returns {Promise<Object>} - { success, descriptions: [{ imageId, description }], message }
 */
const generateImageDescriptionsFromImages = async (documentId, images) => {
    // TODO: When LLM service is ready, call it with the image data:
    // try {
    //     const response = await axios.post(
    //         `${LLM_SERVICE_URL}/api/helper/image-descriptions`,
    //         { documentId, images },
    //         { timeout: 60000 } // Longer timeout for AI processing
    //     );
    //     return response.data;
    // } catch (error) {
    //     console.error('LLM service image descriptions error:', error.message);
    //     // Fall back to mock
    //     return generateMockImageDescriptionsFromImages(documentId, images);
    // }

    // For now, return mock response directly
    console.log(`[MOCK] Generating mock descriptions for ${images.length} images in document: ${documentId}`);
    return generateMockImageDescriptionsFromImages(documentId, images);
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
    generateImageDescriptions,
    generateImageDescriptionsFromImages,
    // Classification prompts
    getPromptForClassification,
    // Mock (for development)
    generateMockImageDescriptions,
    generateMockImageDescriptionsFromImages,
};
