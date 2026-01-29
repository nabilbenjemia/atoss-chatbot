/**
 * PreviewFileList Component
 * 
 * Shows the list of files selected for ingestion during preview mode.
 * Displays in the right sidebar, replacing the Helper panel.
 * Allows clicking on files to switch the preview to that file.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useFileQueue, usePreview, useIngestionActions } from '../../context/ingestion';
import { getFileContent } from '../../utils/fileCacheManager';
import { previewEmbeddings } from '../../services/ingestionApi';

/**
 * Single file item in the preview list
 */
function PreviewFileItem({ file, isSelected, isLoading, onSelect }) {
    return (
        <li
            onClick={() => !isLoading && onSelect(file.documentId)}
            className={`
                px-3 py-2 rounded-lg transition-all cursor-pointer
                border-l-4 flex items-center gap-2
                ${isSelected
                    ? 'bg-tum-blue-light-5 border-tum-blue'
                    : 'bg-white border-transparent hover:bg-tum-grey-9 hover:border-tum-grey-4'
                }
                ${isLoading ? 'opacity-50 cursor-wait' : ''}
            `}
        >
            <span className="text-base">📄</span>
            <span className={`text-sm truncate flex-1 ${isSelected ? 'font-semibold text-tum-blue' : 'text-tum-black'}`}>
                {file.filename}
            </span>
            {isSelected && !isLoading && (
                <span className="text-xs text-tum-blue">●</span>
            )}
            {isLoading && isSelected && (
                <svg className="animate-spin w-4 h-4 text-tum-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
        </li>
    );
}

/**
 * PreviewFileList - Shows files selected for ingestion in preview mode
 * Clicking a file switches the preview to show that file's embeddings.
 */
export default function PreviewFileList() {
    const { uploadQueue, selectedDocumentId } = useFileQueue();
    const { previewDocumentIds, previewConfig, isLoadingPreview } = usePreview();
    const actions = useIngestionActions();

    const [switchingToDocId, setSwitchingToDocId] = useState(null);

    // Get files that are in the preview
    const previewFiles = uploadQueue.filter(f => previewDocumentIds.has(f.documentId));
    const totalFiles = previewFiles.length;

    // Handle clicking a file to switch preview
    const handleFileSelect = useCallback(async (documentId) => {
        if (documentId === selectedDocumentId) return; // Already selected
        if (isLoadingPreview || switchingToDocId) return; // Already loading

        setSwitchingToDocId(documentId);

        try {
            // Get the document content from cache
            const content = getFileContent(documentId);
            if (!content) {
                toast.error('Could not load file content');
                return;
            }

            // Generate preview for this file
            const result = await previewEmbeddings(previewConfig.strategy, content);

            if (result.success) {
                // Switch to this file's preview
                actions.switchPreviewFile(documentId, result.preview);
            } else {
                throw new Error(result.error || 'Failed to generate preview');
            }
        } catch (error) {
            console.error('Failed to switch preview:', error);
            toast.error(`Failed to load preview: ${error.message}`);
        } finally {
            setSwitchingToDocId(null);
        }
    }, [selectedDocumentId, isLoadingPreview, switchingToDocId, previewConfig.strategy, actions]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* File List Section */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                    <h4 className="text-xs font-bold text-tum-grey-3 uppercase tracking-wide mb-1">
                        Files to Ingest ({totalFiles})
                    </h4>
                    <p className="text-xs text-tum-grey-4">
                        {previewConfig?.strategy === 'embed_per_page' ? 'Page-Based' :
                            previewConfig?.strategy === 'chunked_document' ? 'Semantic Chunking' :
                                previewConfig?.strategy || 'Unknown'} → {previewConfig?.targetDb || 'Unknown'}
                    </p>
                </div>

                <ul className="space-y-1">
                    {previewFiles.map((file) => (
                        <PreviewFileItem
                            key={file.documentId}
                            file={file}
                            isSelected={file.documentId === selectedDocumentId}
                            isLoading={switchingToDocId === file.documentId}
                            onSelect={handleFileSelect}
                        />
                    ))}
                </ul>

                {/* Help text */}
                {totalFiles > 1 && (
                    <p className="mt-4 text-xs text-tum-grey-4 italic">
                        Click a file to preview its embeddings
                    </p>
                )}
            </div>
        </div>
    );
}
