/**
 * EmbeddingPreview Component
 * 
 * Displays a preview of embeddings that will be created from a document.
 * Shows embedding count, text content, and associated metadata.
 */

import { useState } from 'react';

/**
 * Individual embedding item display
 */
function EmbeddingItem({ embedding, index, isExpanded, onToggle }) {
    const { id, content, metadata } = embedding;

    return (
        <div className="border border-tum-grey-7 rounded-lg overflow-hidden bg-white">
            {/* Header - always visible */}
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between bg-tum-grey-9 hover:bg-tum-grey-8 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-tum-blue text-white text-xs font-bold">
                        {index + 1}
                    </span>
                    <div>
                        <span className="text-sm font-semibold text-tum-black">{id}</span>
                        <span className="text-xs text-tum-grey-4 ml-2">
                            {metadata?.char_count || content.length} chars
                            {metadata?.word_count && ` • ${metadata.word_count} words`}
                        </span>
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 text-tum-grey-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-4 border-t border-tum-grey-7">
                    {/* Text content preview */}
                    <div className="mb-4">
                        <h5 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2">
                            Text to be Embedded
                        </h5>
                        <div className="bg-tum-grey-9 rounded-lg p-3 text-sm text-tum-black font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {content}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div>
                        <h5 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2">
                            Metadata
                        </h5>
                        <div className="bg-tum-blue-light-5 rounded-lg p-3 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(metadata || {}).map(([key, value]) => {
                                    // Skip complex nested objects for display
                                    if (typeof value === 'object' && value !== null) {
                                        if (key === 'images' && Array.isArray(value)) {
                                            return (
                                                <div key={key} className="col-span-2">
                                                    <span className="text-tum-grey-4 text-xs">{key}:</span>
                                                    <span className="ml-2 text-tum-black font-medium">
                                                        {value.length} image(s) - [{value.map(img => img.classification || 'unknown').join(', ')}]
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }
                                    return (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className="text-tum-grey-4 text-xs">{key}:</span>
                                            <span className="text-tum-black font-medium">{String(value)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Preview summary header
 */
function PreviewSummary({ preview }) {
    const { source, total_embeddings, page_count, strategy, documents } = preview;

    // Calculate total stats
    const totalChars = documents?.reduce((acc, doc) => acc + (doc.metadata?.char_count || doc.content?.length || 0), 0) || 0;
    const totalWords = documents?.reduce((acc, doc) => acc + (doc.metadata?.word_count || 0), 0) || 0;

    const strategyLabel = strategy === 'embed_per_page' ? 'Page-Based' :
        strategy === 'chunked_document' ? 'Semantic Chunking' : strategy;

    return (
        <div className="bg-gradient-to-r from-tum-blue-light-5 to-tum-blue-light-4 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-tum-blue">Embedding Preview</h4>
                <span className="px-3 py-1 bg-tum-blue text-white text-xs font-bold rounded-full">
                    {total_embeddings} Embedding{total_embeddings !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-tum-grey-4 text-xs">Source</div>
                    <div className="text-tum-black font-medium truncate" title={source}>{source}</div>
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-tum-grey-4 text-xs">Pages</div>
                    <div className="text-tum-black font-medium">{page_count}</div>
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-tum-grey-4 text-xs">Strategy</div>
                    <div className="text-tum-black font-medium">{strategyLabel}</div>
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-tum-grey-4 text-xs">Total Content</div>
                    <div className="text-tum-black font-medium">
                        {totalWords > 0 ? `${totalWords} words` : `${totalChars} chars`}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Main EmbeddingPreview component
 */
export default function EmbeddingPreview({ preview, isLoading }) {
    const [expandedItems, setExpandedItems] = useState(new Set([0])); // First item expanded by default

    const toggleItem = (index) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedItems(new Set(preview?.documents?.map((_, i) => i) || []));
    };

    const collapseAll = () => {
        setExpandedItems(new Set());
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-tum-blue border-t-transparent mb-4"></div>
                <p className="text-tum-grey-4 text-sm">Generating embedding preview...</p>
            </div>
        );
    }

    if (!preview || !preview.documents?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-tum-grey-4">No embeddings to preview</p>
                <p className="text-tum-grey-5 text-sm mt-1">The document may be empty or all content was deleted</p>
            </div>
        );
    }

    return (
        <div>
            <PreviewSummary preview={preview} />

            {/* Controls */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-tum-grey-4">
                    Click to expand/collapse each embedding
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="text-xs text-tum-blue hover:text-tum-dark-blue font-medium"
                    >
                        Expand All
                    </button>
                    <span className="text-tum-grey-6">|</span>
                    <button
                        onClick={collapseAll}
                        className="text-xs text-tum-blue hover:text-tum-dark-blue font-medium"
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Embedding list */}
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                {preview.documents.map((embedding, index) => (
                    <EmbeddingItem
                        key={embedding.id}
                        embedding={embedding}
                        index={index}
                        isExpanded={expandedItems.has(index)}
                        onToggle={() => toggleItem(index)}
                    />
                ))}
            </div>
        </div>
    );
}
