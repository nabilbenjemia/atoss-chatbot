/**
 * ConnectedFileQueue Component
 * 
 * File queue that connects directly to ingestion context.
 * Owns its own state subscriptions and dispatches actions directly.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    useFileQueue,
    usePreview,
    useUI,
    useIngestionActions,
    useDocument,
    CONTENT_TYPE,
} from '../../context/ingestion';
import { removeUploadedFile, removeIngestedFile, getIngestedFiles } from '../../utils/fileCacheManager';
import FileQueueItem from './FileQueueItem';

export default function ConnectedFileQueue() {
    // Subscribe to relevant state
    const { uploadQueue, ingestedFiles, selectedDocumentId } = useFileQueue();
    const { isPreviewMode, previewDocumentIds } = usePreview();
    const { multiSelectMode, checkedDocumentIds } = useUI();
    const { contentType } = useDocument();
    const actions = useIngestionActions();

    // In preview mode, filter to only show files being previewed
    const displayFiles = isPreviewMode
        ? uploadQueue.filter(f => previewDocumentIds.has(f.documentId))
        : uploadQueue;

    // Handle file selection
    const handleSelect = useCallback((documentId) => {
        actions.selectFile(documentId);
    }, [actions]);

    // Handle check in multi-select mode
    const handleCheck = useCallback((documentId) => {
        actions.checkDocument(documentId);
    }, [actions]);

    // Handle remove from preview
    const handleRemoveFromPreview = useCallback((documentId) => {
        actions.removePreviewFile(documentId);
        if (previewDocumentIds.size <= 1) {
            toast.info('Preview cancelled - no files remaining');
        }
    }, [actions, previewDocumentIds.size]);

    // Handle remove uploaded file
    const handleRemoveUploadedFile = useCallback((documentId) => {
        removeUploadedFile(documentId);
        actions.removeFile(documentId);
        toast.info('File removed');
    }, [actions]);

    // Handle remove ingested file
    const handleRemoveIngestedFile = useCallback((ingestedId) => {
        removeIngestedFile(ingestedId);
        actions.removeIngestedFile(ingestedId);
        actions.loadIngestedFiles(getIngestedFiles());
        toast.info('Ingested file removed from cache');
    }, [actions]);

    // Determine remove handler based on current mode
    const getRemoveHandler = useCallback((documentId) => {
        if (isPreviewMode) {
            return () => handleRemoveFromPreview(documentId);
        }
        if (contentType === CONTENT_TYPE.EMBEDDING) {
            return () => handleRemoveIngestedFile(documentId);
        }
        return () => handleRemoveUploadedFile(documentId);
    }, [isPreviewMode, contentType, handleRemoveFromPreview, handleRemoveIngestedFile, handleRemoveUploadedFile]);

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
                                onSelect={() => handleSelect(doc.documentId)}
                                onCheck={() => handleCheck(doc.documentId)}
                                showCheckbox={multiSelectMode && !isPreviewMode}
                                removableMode={true}
                                onRemoveFromSelection={getRemoveHandler(doc.documentId)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* Ingested Files Section */}
            {!isPreviewMode && ingestedFiles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-tum-grey-7">
                    <h3 className="text-sm font-bold text-tum-black mb-2 uppercase tracking-wide flex items-center gap-2">
                        <span className="text-base">🧠</span>
                        Ingested ({ingestedFiles.length})
                    </h3>
                    <ul className="space-y-2">
                        {ingestedFiles.map((doc) => (
                            <FileQueueItem
                                key={doc.ingestedId || doc.id || doc.documentId}
                                doc={{
                                    ...doc,
                                    id: doc.ingestedId || doc.id || doc.documentId,
                                    documentId: doc.ingestedId || doc.documentId,
                                    status: 'ingested'
                                }}
                                isSelected={(doc.ingestedId || doc.documentId) === selectedDocumentId}
                                isChecked={false}
                                onSelect={() => handleSelect(doc.ingestedId || doc.documentId)}
                                showCheckbox={false}
                                removableMode={true}
                                onRemoveFromSelection={() => handleRemoveIngestedFile(doc.ingestedId || doc.documentId)}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
