/**
 * UploadZone Component
 * 
 * Drag-and-drop file upload zone with file picker.
 * Validates file type and size against config.
 */

import { useCallback } from 'react';
import {
    INGESTION_CONFIG,
    isValidFileType,
    isValidFileSize,
    getFileSizeLimitText,
    getAllowedTypesText,
} from '../../config/ingestionConfig';
import { toast } from 'react-toastify';

/**
 * @param {Object} props
 * @param {Function} props.onFilesSelected - Callback with validated files
 * @param {boolean} props.disabled - Whether upload is disabled
 * @param {boolean} props.isDragging - External drag state
 * @param {Function} props.onDragOver - Drag over handler
 * @param {Function} props.onDragLeave - Drag leave handler
 * @param {Function} props.onDrop - Drop handler
 */
export default function UploadZone({
    onFilesSelected,
    disabled = false,
    isDragging = false,
    onDragOver,
    onDragLeave,
    onDrop,
}) {
    // Validate and filter files
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

    // Handle file input change
    const handleFileInputChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        const validFiles = validateFiles(files);
        if (validFiles.length > 0) {
            onFilesSelected(validFiles);
        }
        e.target.value = ''; // Reset input
    }, [validateFiles, onFilesSelected]);

    // Handle drag over
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        if (onDragOver) onDragOver(e);
    }, [onDragOver]);

    // Handle drag leave
    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        if (onDragLeave) onDragLeave(e);
    }, [onDragLeave]);

    // Handle drop
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        if (onDrop) onDrop(e);

        const files = Array.from(e.dataTransfer.files);
        const validFiles = validateFiles(files);
        if (validFiles.length > 0) {
            onFilesSelected(validFiles);
        }
    }, [onDrop, validateFiles, onFilesSelected]);

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
            onDragOver={!disabled ? handleDragOver : undefined}
            onDragLeave={!disabled ? handleDragLeave : undefined}
            onDrop={!disabled ? handleDrop : undefined}
            onClick={() => !disabled && document.getElementById('file-input').click()}
        >
            <input
                id="file-input"
                type="file"
                className="hidden"
                accept={INGESTION_CONFIG.upload.allowedTypes.join(',')}
                multiple
                onChange={handleFileInputChange}
                disabled={disabled}
            />
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm text-tum-grey-2">
                Drag & drop files here or click to browse
            </p>
            <p className="text-xs text-tum-grey-3 mt-1">
                {getAllowedTypesText()} • Max {getFileSizeLimitText()}
            </p>
        </div>
    );
}
