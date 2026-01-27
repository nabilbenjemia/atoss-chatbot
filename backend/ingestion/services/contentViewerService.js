const axios = require('axios');

/**
 * Content Viewer Service
 * 
 * Component-level operations for ContentViewer and related components.
 * Handles AI helpers, content transformations, and item operations.
 * Communicates with the Python LLM backend.
 */

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

// ============================================================================
// AI HELPERS (Backend-powered)
// ============================================================================

/**
 * Run AI helper function on document content
 * @param {string} helperId - Helper function ID
 * @param {Object} content - Document content
 * @param {Object} params - Additional parameters
 */
const runAiHelper = async (helperId, content, params = {}) => {
    try {
        const response = await axios.post(
            `${LLM_SERVICE_URL}/api/helper/${helperId}`,
            { content, params },
            { timeout: 30000 }
        );
        return response.data;
    } catch (error) {
        console.error('LLM service helper error:', error.message);
        // Return mock response for development
        if (helperId === 'ai_image_descriptions') {
            return generateMockImageDescriptions(content);
        }
        throw error;
    }
};

/**
 * Generate AI descriptions for images in document
 * @param {Object} content - Document content with pages/items
 */
const generateImageDescriptions = async (content) => {
    return runAiHelper('ai_image_descriptions', content);
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

module.exports = {
    // AI Helpers
    runAiHelper,
    generateImageDescriptions,
    // Mock (for development)
    generateMockImageDescriptions,
};
