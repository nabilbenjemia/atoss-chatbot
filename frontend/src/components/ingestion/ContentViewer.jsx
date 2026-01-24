/**
 * ContentViewer Component
 * 
 * Main content viewing area with page navigation.
 * Composes PageContent and PageNavigation.
 */

import PageContent from './PageContent';
import PageNavigation from './PageNavigation';

/**
 * @param {Object} props
 * @param {Object} props.document - Document object { filename, pages, ... }
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {Function} props.onPageChange - Page change handler
 * @param {Function} props.onEditItem - Edit handler (itemId, newContent)
 * @param {Function} props.onDeleteItem - Delete handler (itemId)
 * @param {Function} props.onRestoreItem - Restore handler (itemId)
 * @param {Function} props.onClassChange - Classification change handler (itemId, newClass)
 * @param {Array} props.availableClasses - Available image classification options
 */
export default function ContentViewer({
    document,
    currentPage,
    onPageChange,
    onEditItem,
    onDeleteItem,
    onRestoreItem,
    onClassChange,
    availableClasses = [],
}) {
    if (!document) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-tum-grey-4">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg">Upload a document to get started</p>
                    <p className="text-sm mt-2">
                        Drag and drop files or use the upload zone on the left
                    </p>
                </div>
            </div>
        );
    }

    const totalPages = document.pages?.length || 0;
    const currentPageContent = document.pages?.[currentPage - 1];

    // Handle empty document
    if (totalPages === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-tum-grey-4">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-lg">No content extracted</p>
                    <p className="text-sm mt-2">
                        This document appears to be empty. Try a different file.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <PageContent
                        page={currentPageContent}
                        onEditItem={onEditItem}
                        onDeleteItem={onDeleteItem}
                        onRestoreItem={onRestoreItem}
                        onClassChange={onClassChange}
                        availableClasses={availableClasses}
                    />
                </div>
            </div>

            {/* Page navigation */}
            <PageNavigation
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
            />
        </div>
    );
}
