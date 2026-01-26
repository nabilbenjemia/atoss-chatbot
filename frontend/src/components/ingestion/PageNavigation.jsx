/**
 * PageNavigation Component
 * 
 * Page navigation controls with previous/next buttons.
 */

import { useEffect, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} props.onPageChange - Page change handler
 * @param {boolean} props.enableKeyboard - Enable keyboard navigation (default: true)
 */
export default function PageNavigation({
    currentPage,
    totalPages,
    onPageChange,
    enableKeyboard = true,
}) {
    // Go to a specific page (clamped to valid range)
    const goToPage = useCallback((page) => {
        const newPage = Math.max(1, Math.min(page, totalPages));
        if (newPage !== currentPage) {
            onPageChange(newPage);
        }
    }, [currentPage, totalPages, onPageChange]);

    // Keyboard navigation
    useEffect(() => {
        if (!enableKeyboard) return;

        const handleKeyDown = (e) => {
            // Don't handle if user is typing in an input/textarea
            if (e.target.matches('input, textarea, [contenteditable]')) return;

            if (e.key === 'ArrowLeft') {
                goToPage(currentPage - 1);
            } else if (e.key === 'ArrowRight') {
                goToPage(currentPage + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enableKeyboard, currentPage, goToPage]);

    if (totalPages <= 1) return null;

    return (
        <div className="bg-white border-t border-tum-grey-7 px-6 py-3 flex items-center justify-center space-x-4">
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 transition-all disabled:opacity-40
                    bg-white border border-tum-blue hover:bg-tum-blue-light-5 text-tum-blue font-bold"
                aria-label="Previous page"
            >
                ← Previous
            </button>

            <span className="text-sm font-bold text-tum-black">
                Page {currentPage} of {totalPages}
            </span>

            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 transition-all disabled:opacity-40
                    bg-white border border-tum-blue hover:bg-tum-blue-light-5 text-tum-blue font-bold"
                aria-label="Next page"
            >
                Next →
            </button>
        </div>
    );
}
