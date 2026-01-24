/**
 * ImageItem Component
 * 
 * Displays an image with classification badge and controls.
 * Supports delete, classification change, and lightbox expand.
 */

import { useState, useCallback } from 'react';
import { INGESTION_CONFIG } from '../../config/ingestionConfig';

/**
 * @param {Object} props
 * @param {Object} props.item - Image item object { id, type, imageUrl, classification, deleted }
 * @param {Function} props.onDelete - Delete handler (itemId)
 * @param {Function} props.onRestore - Restore handler (itemId)
 * @param {Function} props.onClassChange - Classification change handler (itemId, newClass)
 * @param {Array} props.availableClasses - Available classification options
 */
export default function ImageItem({
    item,
    onDelete,
    onRestore,
    onClassChange,
    availableClasses = [],
}) {
    const [showLightbox, setShowLightbox] = useState(false);
    const [showClassDropdown, setShowClassDropdown] = useState(false);

    // Check if image needs resizing
    const needsResize =
        item.imageWidth > INGESTION_CONFIG.image.maxDisplayWidth ||
        item.imageHeight > INGESTION_CONFIG.image.maxDisplayHeight;

    // Handle classification change
    const handleClassChange = useCallback((newClass) => {
        if (onClassChange) {
            onClassChange(item.id, newClass);
        }
        setShowClassDropdown(false);
    }, [item.id, onClassChange]);

    // Deleted state
    if (item.deleted) {
        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7 opacity-50">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-red-500 font-medium">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="text-xs text-tum-blue hover:text-tum-dark-blue"
                        >
                            Restore
                        </button>
                    )}
                </div>
                <div className="mt-2 h-16 bg-tum-grey-20 rounded flex items-center justify-center">
                    <span className="text-tum-grey-4 text-sm">Image deleted</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7 group">
                <div className="relative">
                    {/* Image */}
                    <img
                        src={item.imageUrl}
                        alt="Document image"
                        className={`rounded-lg cursor-pointer ${needsResize ? 'max-w-full h-auto' : ''}`}
                        style={{
                            maxWidth: INGESTION_CONFIG.image.maxDisplayWidth,
                            maxHeight: INGESTION_CONFIG.image.maxDisplayHeight,
                        }}
                        onClick={() => setShowLightbox(true)}
                        title={needsResize ? 'Click to expand' : undefined}
                    />

                    {/* Classification badge */}
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={() => setShowClassDropdown(!showClassDropdown)}
                            className="px-2 py-1 rounded-full text-xs font-medium
                                bg-tum-blue-light-2 text-tum-blue hover:bg-tum-blue-light-1
                                transition-colors"
                        >
                            {item.classification || 'unclassified'}
                        </button>

                        {/* Classification dropdown */}
                        {showClassDropdown && availableClasses.length > 0 && (
                            <div className="absolute top-full right-0 mt-1 bg-white border border-tum-grey-7 
                                rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                                {availableClasses.map((cls) => (
                                    <button
                                        key={cls}
                                        onClick={() => handleClassChange(cls)}
                                        className={`
                                            w-full px-3 py-1 text-left text-xs hover:bg-tum-blue-light-3
                                            ${cls === item.classification ? 'text-tum-blue font-medium' : 'text-tum-grey-1'}
                                        `}
                                    >
                                        {cls}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Expand hint for large images */}
                    {needsResize && (
                        <div className="absolute bottom-2 left-2 text-xs text-tum-grey-4 
                            bg-white/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to expand
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onDelete && (
                        <button
                            onClick={() => onDelete(item.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                        >
                            🗑️ Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {showLightbox && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowLightbox(false)}
                >
                    <div className="relative max-w-full max-h-full overflow-auto">
                        <img
                            src={item.imageUrl}
                            alt="Document image (full size)"
                            className="max-w-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setShowLightbox(false)}
                            className="absolute top-4 right-4 text-white bg-black/50 
                                rounded-full w-8 h-8 flex items-center justify-center
                                hover:bg-black/70 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
