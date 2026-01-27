/**
 * Ingestion Mock Data
 * 
 * Utilities and mock data still used by frontend for:
 * - Development authentication bypass
 * - Data format conversion
 */

// Mock delay helper (used for UI transitions)
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock user for development (bypassing auth)
export const mockCurrentUser = {
    id: 'dev_user_1',
    email: 'admin@tum.de',
    firstName: 'Dev',
    lastName: 'Admin',
    role: 'admin', // TODO: Remove mock when auth provides role
};

// Check if we should use mock user (development mode)
export const shouldUseMockAuth = () => {
    // In development, bypass auth for ingestion page
    return import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === 'true';
};

/**
 * Convert embedding preview to simulated backend response
 * This replaces base64 imageUrls with mock server URLs
 * @param {Object} preview - The embedding preview with base64 images
 * @returns {Object} - Preview with server URLs for images
 */
export const convertPreviewToIngestedFormat = (preview) => {
    if (!preview || !preview.documents) return preview;

    const SERVER_BASE = 'http://localhost:8000/static/embeddings';

    const documents = preview.documents.map(doc => {
        if (!doc.metadata?.images) return doc;

        const updatedImages = doc.metadata.images.map(img => ({
            ...img,
            // Replace base64 URL with mock server URL
            imageUrl: `${SERVER_BASE}/${preview.source}/${img.uuid}.png`,
            // Mark original imageUrl as stored separately
            storedLocally: false,
        }));

        return {
            ...doc,
            metadata: {
                ...doc.metadata,
                images: updatedImages,
            },
        };
    });

    return {
        ...preview,
        documents,
        ingestedAt: new Date().toISOString(),
        status: 'ingested',
    };
};
