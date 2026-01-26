/**
 * IngestionModal Component
 * 
 * Modal for selecting target database and starting ingestion.
 * Options loaded from backend config (no hardcoded values).
 */

import { useState, useEffect } from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler (targetDb)
 * @param {Object} props.backendConfig - Backend configuration with availableTargetDbs
 * @param {boolean} props.isIngesting - Whether ingestion is in progress
 * @param {number} props.progress - Ingestion progress (0-100)
 */
export default function IngestionModal({
    isOpen,
    onClose,
    onConfirm,
    backendConfig,
    isIngesting = false,
    progress = 0,
}) {
    const [selectedDb, setSelectedDb] = useState('');

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedDb('');
        }
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !isIngesting) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isIngesting, onClose]);

    if (!isOpen) return null;

    const availableDbs = backendConfig?.availableTargetDbs || [];
    const embeddingModels = backendConfig?.embeddingModels || [];

    return (
        <div className="fixed inset-0 bg-tum-black/50 flex items-center justify-center z-50">
            <div
                className="bg-white p-6 w-96 max-w-[90vw] shadow-lg border-t-4 border-tum-blue"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-tum-blue mb-6">
                    Start Ingestion
                </h2>

                {/* Target Database */}
                <div className="mb-4">
                    <label className="block text-sm font-bold text-tum-black mb-2">
                        Target Database
                    </label>
                    <select
                        value={selectedDb}
                        onChange={(e) => setSelectedDb(e.target.value)}
                        disabled={isIngesting}
                        className="w-full border border-tum-grey-7 px-3 py-2 outline-none transition
                            bg-white text-tum-black
                            focus:border-tum-blue focus:ring-1 focus:ring-tum-blue
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Select a database...</option>
                        {availableDbs.map((db) => (
                            <option key={db.id} value={db.id}>
                                {db.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Embedding Model (disabled for MVP) */}
                {embeddingModels.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-tum-black mb-2">
                            Embedding Model
                            <span className="text-xs text-tum-grey-4 ml-2">(coming soon)</span>
                        </label>
                        <select
                            disabled
                            className="w-full border border-tum-grey-7 px-3 py-2 outline-none
                                opacity-50 cursor-not-allowed bg-tum-blue-light-5"
                        >
                            {embeddingModels.map((model) => (
                                <option key={model.id} value={model.id} disabled={model.disabled}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Progress bar during ingestion */}
                {isIngesting && (
                    <div className="mb-4">
                        <div className="h-2 bg-tum-grey-8 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-tum-blue transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-tum-grey-4 mt-1 text-center">
                            {progress}% complete
                        </p>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isIngesting}
                        className="flex-1 px-4 py-2 rounded-xl border border-tum-grey-7 text-tum-grey-1
                            bg-white hover:bg-tum-grey-8 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(selectedDb)}
                        disabled={!selectedDb || isIngesting}
                        className="flex-1 px-4 py-2 rounded-xl bg-tum-blue hover:bg-tum-dark-blue text-white
                            transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isIngesting ? 'Ingesting...' : 'Start'}
                    </button>
                </div>
            </div>
        </div>
    );
}
