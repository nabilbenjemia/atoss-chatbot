/**
 * useLocalStrategy Hook
 * 
 * Handles local (frontend-only) embedding strategies that don't require backend processing.
 * Strategies: embed_per_page, chunked_fixed, chunked_document
 * 
 * @see doc/ingestion/API_CONTRACTS.md
 */

import { useCallback, useMemo } from 'react';

/**
 * LOCAL STRATEGIES - IDs that are handled in frontend
 * These strategies do not require backend processing
 */
export const LOCAL_STRATEGIES = ['embed_per_page', 'chunked_fixed', 'chunked_document'];

/**
 * Generate a simple hash from a string for unique ID generation
 * @param {string} str - The string to hash
 * @returns {string} - A short hash string
 */
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
};

/**
 * Generate page-based embeddings (one embedding per page)
 * @param {Object} documentState - The document state with pages
 * @param {string} fileHash - Unique hash for the file
 * @param {string} filename - The filename
 * @returns {Array} - Array of document objects for embedding
 */
const generatePageEmbeddings = (documentState, fileHash, filename) => {
    const documents = [];

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
                // Include fileHash in ID to make it unique across different files
                id: `${fileHash}_page_${pageNum}`,
                content: fullContent,
                metadata: {
                    page_num: pageNum,
                    source: filename,
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

    return documents;
};

/**
 * Generate fixed-size chunk embeddings with overlap
 * @param {Object} documentState - The document state with pages
 * @param {string} fileHash - Unique hash for the file
 * @param {string} filename - The filename
 * @param {number} chunkSize - Size of each chunk (default: 500)
 * @param {number} overlap - Overlap between chunks (default: 100)
 * @returns {Array} - Array of document objects for embedding
 */
const generateChunkedEmbeddings = (documentState, fileHash, filename, chunkSize = 500, overlap = 100) => {
    const documents = [];

    // Merge all content from all pages
    const allContent = (documentState.pages || []).flatMap(page =>
        (page.items || [])
            .filter(item => !item.deleted && item.type === 'text')
            .map(item => item.content)
    ).join('\n\n');

    let position = 0;
    let chunkIndex = 1;

    while (position < allContent.length) {
        const end = Math.min(position + chunkSize, allContent.length);
        const chunk = allContent.slice(position, end);

        documents.push({
            // Include fileHash in ID to make it unique across different files
            id: `${fileHash}_chunk_${chunkIndex}`,
            content: chunk,
            metadata: {
                chunk_index: chunkIndex,
                source: filename,
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

    return documents;
};

/**
 * Generate embedding preview locally (for local strategies)
 * This is the frontend implementation of preview generation.
 * 
 * @param {string} strategy - The embedding strategy
 * @param {Object} documentState - The document state with pages
 * @returns {Object} - Preview of embeddings
 */
export const generateLocalPreview = (strategy, documentState) => {
    const filename = documentState.filename || 'unknown';
    // Create a unique prefix from filename to avoid ID collisions across files
    const fileHash = simpleHash(filename + Date.now().toString());

    let documents = [];

    if (strategy === 'embed_per_page') {
        documents = generatePageEmbeddings(documentState, fileHash, filename);
    } else if (strategy === 'chunked_fixed' || strategy === 'chunked_document') {
        documents = generateChunkedEmbeddings(documentState, fileHash, filename);
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
 * Check if a strategy is local (handled in frontend)
 * @param {string} strategyId - The strategy ID
 * @returns {boolean}
 */
export const isLocalStrategy = (strategyId) => {
    return LOCAL_STRATEGIES.includes(strategyId);
};

/**
 * Hook for using local strategies
 * Provides memoized functions for generating previews and checking strategy types.
 * 
 * @returns {Object} - { generatePreview, isLocal, localStrategies }
 */
export default function useLocalStrategy() {
    /**
     * Generate preview for a local strategy
     * @param {string} strategy - The embedding strategy
     * @param {Object} documentState - The document state with pages
     * @returns {Object|null} - Preview object or null if not a local strategy
     */
    const generatePreview = useCallback((strategy, documentState) => {
        if (!isLocalStrategy(strategy)) {
            return null;
        }
        return generateLocalPreview(strategy, documentState);
    }, []);

    /**
     * Check if a strategy is local
     */
    const isLocal = useCallback((strategyId) => {
        return isLocalStrategy(strategyId);
    }, []);

    /**
     * List of local strategy IDs
     */
    const localStrategies = useMemo(() => LOCAL_STRATEGIES, []);

    return {
        generatePreview,
        isLocal,
        localStrategies,
        // Also export the raw function for non-hook usage
        generateLocalPreview,
    };
}
