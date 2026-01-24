/**
 * FileQueue Component
 * 
 * Displays list of uploaded files with their status.
 */

import FileQueueItem from './FileQueueItem';

/**
 * @param {Object} props
 * @param {Array} props.files - Array of document objects
 * @param {string} props.selectedDocumentId - Currently selected document ID
 * @param {Function} props.onSelect - Selection handler
 * @param {Function} props.onRemove - Remove handler
 */
export default function FileQueue({
    files = [],
    selectedDocumentId,
    onSelect,
    onRemove,
}) {
    return (
        <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-semibold text-tum-grey-1 mb-2">
                Files ({files.length})
            </h3>

            {files.length === 0 ? (
                <p className="text-sm text-tum-grey-4">No files uploaded yet</p>
            ) : (
                <ul className="space-y-2">
                    {files.map((doc) => (
                        <FileQueueItem
                            key={doc.id}
                            doc={doc}
                            isSelected={doc.documentId === selectedDocumentId}
                            onSelect={onSelect}
                            onRemove={onRemove}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}
