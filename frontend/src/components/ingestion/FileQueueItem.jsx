/**
 * FileQueueItem Component
 * 
 * Displays a single file in the upload queue with status and progress.
 * Double-click on filename to edit it.
 */

import { useState, useRef, useEffect } from 'react';
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
 * @param {Function} props.onRename - Rename handler (optional) - (docId, newFilename)
 */
export default function FileQueueItem({
    doc,
    isSelected = false,
    onSelect,
    onRemove,
    onRename,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(doc.filename);
    const inputRef = useRef(null);

    const showProgress = [DOC_STATUS.UPLOADING, DOC_STATUS.PROCESSING, DOC_STATUS.INGESTING].includes(doc.status);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Reset edit name when doc changes
    useEffect(() => {
        setEditName(doc.filename);
    }, [doc.filename]);

    const handleSave = () => {
        const trimmedName = editName.trim();
        if (trimmedName && trimmedName !== doc.filename && onRename) {
            onRename(doc.id, trimmedName);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(doc.filename);
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <li
            className={`
                p-3 cursor-pointer transition-all border-b border-white
                ${isSelected
                    ? 'bg-tum-blue text-white'
                    : 'bg-tum-blue-light-5 hover:bg-tum-blue-light-3 text-tum-black'}
            `}
            onClick={() => !isEditing && doc.documentId && onSelect && onSelect(doc.documentId)}
        >
            <div className="flex items-center justify-between">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-sm px-2 py-1 rounded border border-tum-grey-7 
                            bg-white text-tum-grey-1 focus:outline-none focus:ring-2 focus:ring-tum-blue-light"
                    />
                ) : (
                    <span
                        className="text-sm truncate flex-1 cursor-text"
                        title={`${doc.filename} (double-click to rename)`}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    >
                        {doc.filename}
                    </span>
                )}
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
