/**
 * FileQueue Component
 * 
 * Displays list of uploaded files with their status.
 * Supports:
 * - Multi-select mode for batch operations
 * - Preview mode filtering (shows only files being previewed)
 * - Dual sections: Files (uploaded) and Ingested Files
 * - Removable mode with hover X
 */

import FileQueueItem from './FileQueueItem';

/**
 * @param {Object} props
 * @param {Array} props.files - Array of document objects (uploaded files)
 * @param {Array} props.ingestedFiles - Array of ingested document objects
 * @param {string} props.selectedDocumentId - Currently selected document ID
 * @param {Set} props.checkedDocumentIds - Set of checked document IDs (multi-select)
 * @param {Function} props.onSelect - Selection handler
 * @param {Function} props.onCheck - Check handler for multi-select
 * @param {Function} props.onRemove - Remove handler
 * @param {boolean} props.multiSelectMode - Whether multi-select is enabled
 * @param {boolean} props.isPreviewMode - Whether in embedding preview mode
 * @param {Set} props.previewDocumentIds - Set of document IDs being previewed
 * @param {Function} props.onRemoveFromPreview - Handler for removing file from preview
 * @param {Function} props.onRemoveFromContent - Handler for removing file from content view
 * @param {boolean} props.showIngestedSection - Whether to show the ingested files section
 */
export default function FileQueue({
    files = [],
    ingestedFiles = [],
    selectedDocumentId,
    checkedDocumentIds = new Set(),
    onSelect,
    onCheck,
    onRemove,
    multiSelectMode = false,
    isPreviewMode = false,
    previewDocumentIds = new Set(),
    onRemoveFromPreview,
    onRemoveFromContent,
    showIngestedSection = true,
}) {
    // In preview mode, filter to only show files being previewed
    const displayFiles = isPreviewMode
        ? files.filter(f => previewDocumentIds.has(f.documentId))
        : files;

    const handleRemoveFromSelection = (documentId) => {
        if (isPreviewMode && onRemoveFromPreview) {
            onRemoveFromPreview(documentId);
        } else if (onRemoveFromContent) {
            onRemoveFromContent(documentId);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Files Section (Uploaded/Content) */}
            <div className="flex-1">
                <h3 className="text-sm font-bold text-tum-black mb-2 uppercase tracking-wide">
                    {isPreviewMode ? 'Preview Files' : 'Files'} ({displayFiles.length})
                    {multiSelectMode && checkedDocumentIds.size > 0 && (
                        <span className="ml-2 text-tum-blue">
                            • {checkedDocumentIds.size} selected
                        </span>
                    )}
                </h3>

                {displayFiles.length === 0 ? (
                    <p className="text-sm text-tum-black/60 italic">
                        {isPreviewMode ? 'No files in preview' : 'No files uploaded yet'}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {displayFiles.map((doc) => (
                            <FileQueueItem
                                key={doc.id}
                                doc={doc}
                                isSelected={doc.documentId === selectedDocumentId}
                                isChecked={checkedDocumentIds.has(doc.documentId)}
                                onSelect={onSelect}
                                onCheck={onCheck}
                                onRemove={onRemove}
                                showCheckbox={multiSelectMode && !isPreviewMode}
                                removableMode={isPreviewMode || displayFiles.length > 0}
                                onRemoveFromSelection={handleRemoveFromSelection}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* Ingested Files Section */}
            {showIngestedSection && !isPreviewMode && ingestedFiles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-tum-grey-7">
                    <h3 className="text-sm font-bold text-tum-black mb-2 uppercase tracking-wide flex items-center gap-2">
                        <span className="text-base">🧠</span>
                        Ingested ({ingestedFiles.length})
                    </h3>
                    <ul className="space-y-2">
                        {ingestedFiles.map((doc) => (
                            <FileQueueItem
                                key={doc.id || doc.documentId}
                                doc={{ ...doc, id: doc.id || doc.documentId, status: 'ingested' }}
                                isSelected={doc.documentId === selectedDocumentId}
                                isChecked={false}
                                onSelect={onSelect}
                                showCheckbox={false}
                                removableMode={true}
                                onRemoveFromSelection={onRemoveFromContent}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
