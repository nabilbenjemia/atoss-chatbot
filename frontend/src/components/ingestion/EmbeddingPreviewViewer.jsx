/**
 * EmbeddingPreviewViewer Component
 * 
 * Displays embedding previews in a paginated view within the main content area.
 * Shows text content, images (base64), tables, and metadata for each embedding.
 * Replaces ContentViewer when in preview mode.
 * 
 * Supports:
 * - Single file preview with "Confirm & Ingest"
 * - Multi-file preview with "More" dropdown containing "Confirm & Ingest All"
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import PageNavigation from './PageNavigation';

/**
 * Single Embedding Display
 */
function EmbeddingCard({ embedding, embeddingNumber }) {
    const { id, content, metadata } = embedding;
    const images = metadata?.images || [];
    const tables = metadata?.tables || [];

    return (
        <div className="bg-white rounded-xl border border-tum-grey-7 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-tum-blue to-tum-dark-blue px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-tum-blue text-sm font-bold">
                        {embeddingNumber}
                    </span>
                    <div>
                        <h3 className="text-white font-semibold">{id}</h3>
                        <p className="text-tum-blue-light-4 text-xs">
                            {metadata?.char_count || content?.length || 0} chars
                            {metadata?.word_count && ` • ${metadata.word_count} words`}
                            {images.length > 0 && ` • ${images.length} image(s)`}
                            {tables.length > 0 && ` • ${tables.length} table(s)`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Text Content */}
                {content && (
                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Text to be Embedded
                        </h4>
                        <div className="bg-tum-grey-9 rounded-lg p-4 text-sm text-tum-black font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {content}
                        </div>
                    </div>
                )}

                {/* Images */}
                {images.length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Images ({images.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {images.map((img, idx) => (
                                <div key={img.uuid || idx} className="border border-tum-grey-7 rounded-lg overflow-hidden bg-tum-grey-9">
                                    {img.imageUrl && (
                                        <div className="flex items-center justify-center p-2 bg-white">
                                            <img
                                                src={img.imageUrl}
                                                alt={img.description || `Image ${idx + 1}`}
                                                className="max-h-40 object-contain"
                                                style={{
                                                    maxWidth: img.imageWidth ? Math.min(img.imageWidth, 300) : '100%'
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="px-3 py-2 bg-tum-grey-9 border-t border-tum-grey-7">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-tum-grey-4">Classification:</span>
                                            <span className="font-medium text-tum-blue px-2 py-0.5 bg-tum-blue-light-5 rounded">
                                                {img.classification || 'unknown'}
                                            </span>
                                        </div>
                                        {img.description && (
                                            <p className="text-xs text-tum-grey-3 mt-1 italic">{img.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tables */}
                {tables.length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7-8v8m14-8v8M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Tables ({tables.length})
                        </h4>
                        {tables.map((table, idx) => (
                            <div key={table.id || idx} className="border border-tum-grey-7 rounded-lg overflow-hidden mb-2">
                                {table.tableData && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            {table.tableData.headers && (
                                                <thead className="bg-tum-blue-light-5">
                                                    <tr>
                                                        {table.tableData.headers.map((header, hIdx) => (
                                                            <th key={hIdx} className="px-3 py-2 text-left text-tum-blue font-semibold border-b border-tum-grey-7">
                                                                {header}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                            )}
                                            <tbody>
                                                {table.tableData.rows?.map((row, rIdx) => (
                                                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-tum-grey-9'}>
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx} className="px-3 py-2 text-tum-black border-b border-tum-grey-8">
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Metadata */}
                <div>
                    <h4 className="text-xs font-semibold text-tum-grey-3 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Metadata
                    </h4>
                    <div className="bg-tum-blue-light-5 rounded-lg p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                            {Object.entries(metadata || {}).map(([key, value]) => {
                                // Skip complex objects (images, tables) - they're shown above
                                if (typeof value === 'object' && value !== null) {
                                    return null;
                                }
                                return (
                                    <div key={key} className="flex flex-col">
                                        <span className="text-tum-grey-4 text-xs">{key}</span>
                                        <span className="text-tum-black font-medium">{String(value)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Items per page selector
 */
function ItemsPerPageSelector({ value, onChange, hasVisualContent }) {
    const options = hasVisualContent
        ? [1, 2, 3, 5]
        : [1, 3, 5, 10, 20];

    return (
        <div className="flex items-center gap-2 text-sm">
            <label className="text-tum-grey-4">Show:</label>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="px-2 py-1 border border-tum-grey-7 rounded text-tum-black bg-white 
                    focus:outline-none focus:ring-1 focus:ring-tum-blue cursor-pointer"
            >
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt} per page</option>
                ))}
            </select>
        </div>
    );
}

/**
 * Main EmbeddingPreviewViewer component
 * 
 * @param {Object} props
 * @param {Object} props.preview - Embedding preview data
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onCancel - Cancel handler (null for read-only mode)
 * @param {Function} props.onConfirm - Confirm handler for single file (null for read-only mode)
 * @param {Function} props.onConfirmAll - Confirm handler for all files (multi-file mode)
 * @param {boolean} props.readOnly - Whether to hide action buttons
 * @param {boolean} props.isMultiFile - Whether multiple files are being previewed
 * @param {number} props.totalFilesInPreview - Total number of files in preview (for multi-file)
 */
export default function EmbeddingPreviewViewer({
    preview,
    isLoading,
    onCancel,
    onConfirm,
    onConfirmAll,
    readOnly = false,
    isMultiFile = false,
    totalFilesInPreview = 1,
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(3);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef(null);

    const documents = preview?.documents || [];
    const totalItems = documents.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Check if any document has images or tables (visual content)
    const hasVisualContent = documents.some(doc =>
        (doc.metadata?.images?.length > 0) || (doc.metadata?.tables?.length > 0)
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-adjust items per page if visual content is detected
    useEffect(() => {
        if (hasVisualContent && itemsPerPage > 3) {
            setItemsPerPage(1);
        }
    }, [hasVisualContent, itemsPerPage]);

    // Reset to page 1 when items per page changes
    useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage]);

    // Get current page items
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentItems = documents.slice(startIndex, endIndex);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const handleConfirmAll = () => {
        setShowMoreMenu(false);
        if (onConfirmAll) {
            onConfirmAll();
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-tum-blue border-t-transparent mb-4"></div>
                <p className="text-tum-grey-4 text-sm">Generating embedding preview...</p>
            </div>
        );
    }

    if (!preview || !documents.length) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-lg text-tum-grey-4">No embeddings to preview</p>
                <p className="text-sm text-tum-grey-5 mt-1">The document may be empty or all content was deleted</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Action Bar */}
            <div className="bg-gradient-to-r from-tum-blue-light-5 to-tum-blue-light-4 border-b border-tum-grey-7 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    {!readOnly ? (
                        <>
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm font-semibold text-tum-black bg-white border border-tum-grey-7 
                                    rounded-lg hover:bg-tum-grey-9 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className="px-4 py-2 text-sm font-semibold text-white bg-tum-blue 
                                    rounded-lg hover:bg-tum-dark-blue transition-colors flex items-center gap-2
                                    shadow-md shadow-tum-blue/20"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm & Ingest
                            </button>

                            {/* More Menu for Multi-File */}
                            {isMultiFile && totalFilesInPreview > 1 && (
                                <div className="relative" ref={moreMenuRef}>
                                    <button
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                        className="px-3 py-2 text-sm font-semibold text-tum-blue bg-white border border-tum-blue 
                                            rounded-lg hover:bg-tum-blue-light-5 transition-colors flex items-center gap-2"
                                    >
                                        More
                                        <svg
                                            className={`w-4 h-4 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showMoreMenu && (
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-tum-grey-7 
                                            rounded-lg shadow-lg py-1 min-w-[200px] z-10">
                                            <button
                                                onClick={handleConfirmAll}
                                                className="w-full px-4 py-2 text-sm text-left text-tum-black hover:bg-tum-blue-light-5 
                                                    transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4 text-tum-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Confirm & Ingest All ({totalFilesInPreview})
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-tum-green">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-semibold">Ingested Document</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <ItemsPerPageSelector
                        value={itemsPerPage}
                        onChange={setItemsPerPage}
                        hasVisualContent={hasVisualContent}
                    />
                    <div className="text-sm">
                        <span className="font-bold text-tum-blue">{totalItems}</span>
                        <span className="text-tum-grey-4"> total embedding{totalItems !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            {/* Summary Bar */}
            <div className="bg-white border-b border-tum-grey-7 px-6 py-2 flex items-center justify-between text-sm shrink-0">
                <div className="flex items-center gap-4 text-tum-grey-4">
                    <span><strong className="text-tum-black">{preview.source}</strong></span>
                    <span>•</span>
                    <span>{preview.page_count} page{preview.page_count !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-tum-blue-light-5 text-tum-blue rounded font-medium">
                        {preview.strategy === 'embed_per_page' ? 'Page-Based' :
                            preview.strategy === 'chunked_document' ? 'Semantic Chunking' : preview.strategy}
                    </span>
                </div>
                <div className="text-tum-grey-4">
                    Showing {startIndex + 1}-{endIndex} of {totalItems}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {currentItems.map((embedding, idx) => (
                        <EmbeddingCard
                            key={embedding.id}
                            embedding={embedding}
                            embeddingNumber={startIndex + idx + 1}
                        />
                    ))}
                </div>
            </div>

            {/* Page Navigation */}
            {totalPages > 1 && (
                <PageNavigation
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    );
}
