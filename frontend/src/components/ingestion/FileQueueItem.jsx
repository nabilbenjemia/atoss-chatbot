/**
 * FileQueueItem Component
 * 
 * Displays a single file in the upload queue with status and progress.
 */

import { DOC_STATUS } from './constants';

/**
 * Get status icon for document
 * @param {string} status - Document status
 * @returns {string} - Emoji icon
 */
const getStatusIcon = (status) => {
    switch (status) {
        case DOC_STATUS.COMPLETED:
            return '✅';
        case DOC_STATUS.ERROR:
            return '❌';
        case DOC_STATUS.READY:
            return '📋';
        case DOC_STATUS.QUEUED:
        case DOC_STATUS.UPLOADING:
        case DOC_STATUS.PROCESSING:
        case DOC_STATUS.INGESTING:
            return '⏳';
        default:
            return '📄';
    }
};

/**
 * @param {Object} props
 * @param {Object} props.doc - Document object
 * @param {boolean} props.isSelected - Whether this document is selected
 * @param {Function} props.onSelect - Selection handler
 * @param {Function} props.onRemove - Remove handler (optional)
 */
export default function FileQueueItem({
    doc,
    isSelected = false,
    onSelect,
    onRemove,
}) {
    const showProgress = [DOC_STATUS.UPLOADING, DOC_STATUS.PROCESSING, DOC_STATUS.INGESTING].includes(doc.status);

    return (
        <li
            className={`
                p-3 rounded-lg cursor-pointer transition-all
                ${isSelected
                    ? 'bg-tum-blue text-white'
                    : 'bg-white hover:bg-tum-blue-light-2'}
            `}
            onClick={() => doc.documentId && onSelect && onSelect(doc.documentId)}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm truncate flex-1" title={doc.filename}>
                    {doc.filename}
                </span>
                <span className="text-xs ml-2">
                    {getStatusIcon(doc.status)}
                </span>
            </div>

            {/* Progress bar */}
            {showProgress && (
                <div className="mt-2 h-1 bg-tum-grey-7 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-tum-blue transition-all duration-300"
                        style={{ width: `${doc.progress}%` }}
                    />
                </div>
            )}

            {/* Error message */}
            {doc.status === DOC_STATUS.ERROR && doc.error && (
                <p className="mt-1 text-xs text-red-500 truncate" title={doc.error}>
                    {doc.error}
                </p>
            )}

            {/* Remove button for queued files */}
            {doc.status === DOC_STATUS.QUEUED && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(doc.id);
                    }}
                    className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                    Remove
                </button>
            )}
        </li>
    );
}
