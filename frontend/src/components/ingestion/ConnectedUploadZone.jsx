/**
 * ConnectedUploadZone Component
 * 
 * Upload zone that connects directly to ingestion context.
 * Handles file upload logic internally.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    useUI, //hooks
    usePreview, //hooks
    useFileQueue, //hooks
    useIngestionActions, // hooks
    DOC_STATUS, //constants
} from '../../context/ingestion';
import { uploadDocument } from '../../services/ingestionApi';
import { saveFileContent, addUploadedFile } from '../../utils/fileCacheManager';
import {
    isValidFileType,
    isValidFileSize,
    getFileSizeLimitText,
    getAllowedTypesText,
} from '../../config/ingestionConfig';

export default function ConnectedUploadZone() {
    //subscribe to contexts
    const { isDragging, isIngesting } = useUI();
    const { isPreviewMode } = usePreview();
    const { selectedDocumentId } = useFileQueue();
    const actions = useIngestionActions();

    const disabled = isIngesting || isPreviewMode;

    // Validate files
    const validateFiles = useCallback((files) => {
        const validFiles = [];
        for (const file of files) {
            if (!isValidFileType(file)) {
                toast.error(`Invalid file type: ${file.name}. Supported: ${getAllowedTypesText()}`);
                continue;
            }
            if (!isValidFileSize(file)) {
                toast.error(`File too large: ${file.name}. Max size: ${getFileSizeLimitText()}`);
                continue;
            }
            validFiles.push(file);
        }
        return validFiles;
    }, []);

    // Handle file upload
    const handleFilesSelected = useCallback(async (files) => {
        const validFiles = validateFiles(files);
        if (validFiles.length === 0) return;

        for (const file of validFiles) {
            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Start upload
            actions.startFileUpload(uploadId, file, file.name);
            actions.updateFileProgress(uploadId, DOC_STATUS.UPLOADING, 10);

            try {
                const result = await uploadDocument(file);
                if (!result.success || !result.content) {
                    throw new Error(result.error || 'Failed to process document');
                }

                const documentId = result.content.documentId;

                // Cache the content
                saveFileContent(documentId, result.content);

                // Complete upload in state
                actions.completeFileUpload(uploadId, documentId);

                // Save to uploaded files cache
                addUploadedFile({
                    id: uploadId,
                    documentId,
                    filename: file.name,
                    status: DOC_STATUS.READY,
                });

                toast.success(`Document ready: ${file.name}`);

                // Auto-select if no document selected
                if (!selectedDocumentId) {
                    actions.selectFile(documentId);
                }
            } catch (error) {
                console.error('Upload failed:', error);
                actions.failFileUpload(uploadId, error.message);
                toast.error(`Upload failed: ${file.name}`);
            }
        }
    }, [validateFiles, actions, selectedDocumentId]);

    // Handle file input change
    const handleFileInputChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        handleFilesSelected(files);
        e.target.value = ''; // Reset input
    }, [handleFilesSelected]);

    // Handle drag events
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        if (!disabled) actions.setDragging(true);
    }, [disabled, actions]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        actions.setDragging(false);
    }, [actions]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        actions.setDragging(false);
        if (disabled) return;

        const files = Array.from(e.dataTransfer.files);
        handleFilesSelected(files);
    }, [disabled, actions, handleFilesSelected]);

    return (
        <div
            className={`
                border-2 border-dashed p-6 text-center cursor-pointer transition-all
                bg-white
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isDragging
                    ? 'border-tum-blue bg-tum-blue-light-2'
                    : 'border-tum-grey-7 hover:border-tum-blue hover:bg-tum-blue-light-5'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && document.getElementById('file-upload-input')?.click()}
        >
            <input
                id="file-upload-input"
                type="file"
                className="hidden"
                accept=".pdf"
                multiple
                onChange={handleFileInputChange}
                disabled={disabled}
            />

            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-tum-black font-medium">
                {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-xs text-tum-grey-4 mt-1">
                PDF files, max {getFileSizeLimitText()}
            </p>
        </div>
    );
}
