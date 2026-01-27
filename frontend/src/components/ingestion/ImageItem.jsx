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
            <div className="bg-tum-blue-light-5 p-4 border border-tum-grey-7 opacity-60">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-tum-orange font-bold uppercase">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="px-3 py-1 text-xs font-bold bg-white border border-tum-blue 
                                text-tum-blue hover:bg-tum-blue hover:text-white transition-colors"
                        >
                            Restore
                        </button>
                    )}
                </div>
                <div className="mt-2 h-16 bg-tum-grey-8 flex items-center justify-center">
                    <span className="text-tum-grey-4 text-sm">Image deleted</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white p-4 border border-tum-grey-7 group hover:border-tum-blue transition-colors">
                <div className="relative">
                    {/* Image */}
                    <img
                        src={item.imageUrl}
                        alt="Document image"
                        className={`cursor-pointer ${needsResize ? 'max-w-full h-auto' : ''}`}
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
                            className="px-2 py-1 text-xs font-bold
                                bg-white border border-tum-blue text-tum-blue hover:bg-tum-blue hover:text-white
                                transition-colors shadow-sm"
                        >
                            {item.classification || 'unclassified'}
                        </button>

                        {/* Classification dropdown */}
                        {showClassDropdown && availableClasses.length > 0 && (
                            <div className="absolute top-full right-0 mt-1 bg-white border border-tum-grey-7 
                                shadow-lg py-1 z-10 min-w-[120px]">
                                {availableClasses.map((cls) => (
                                    <button
                                        key={cls}
                                        onClick={() => handleClassChange(cls)}
                                        className={`
                                            w-full px-3 py-2 text-left text-sm transition-colors
                                            hover:bg-tum-blue-light-3
                                            ${cls === item.classification
                                                ? 'text-tum-blue font-medium bg-tum-blue-light-4'
                                                : 'text-tum-grey-1 bg-white'}
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
                <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onDelete && (
                        <button
                            onClick={() => onDelete(item.id)}
                            className="px-3 py-1 text-xs rounded-md bg-white border border-tum-grey-7 
                                text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                            🗑️ Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {showLightbox && (
                <div
                    className="fixed inset-0 bg-tum-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={() => setShowLightbox(false)}
                >
                    <div className="relative max-w-full max-h-full overflow-auto">
                        <img
                            src={item.imageUrl}
                            alt="Document image (full size)"
                            className="max-w-none shadow-2xl rounded-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setShowLightbox(false)}
                            className="absolute top-4 right-4 text-tum-black bg-white/90 
                                rounded-full w-10 h-10 flex items-center justify-center
                                hover:bg-white transition-colors shadow-lg z-50"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
