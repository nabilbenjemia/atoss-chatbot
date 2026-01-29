/**
 * IngestionModal Component
 * 
 * Modern modal for selecting target database and ingestion strategy.
 * Clicking "Preview Embeddings" closes the modal and shows preview in main content area.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

/**
 * Icons for strategies
 */
const ICONS = {
    embed_per_page: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    chunked_document: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    ),
    summarization: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    table_extraction: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7-8v8m14-8v8M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
    ),
    ocr_enhanced: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    )
};

const INGESTION_STRATEGIES = [
    {
        id: 'embed_per_page',
        label: 'Page-Based Embedding',
        shortDesc: 'One vector per page',
        description: 'Best for slide decks or documents where each page is a distinct topic. Preserves layout context.',
        icon: ICONS.embed_per_page
    },
    {
        id: 'chunked_document',
        label: 'Semantic Chunking',
        shortDesc: 'Split by meaning',
        description: 'Best for long text like reports or articles. Merges pages and splits content into meaningful overlapping segments.',
        icon: ICONS.chunked_document
    },
    // Mock strategies for testing scroll
    {
        id: 'summarization_first',
        label: 'Summarization First',
        shortDesc: 'Abstract + Details',
        description: 'Generates a high-level summary for the entire document first, then chunks the details. Improves retrieval for broad questions.',
        icon: ICONS.summarization,
        disabled: true
    },
    {
        id: 'table_optimized',
        label: 'Table Optimized',
        shortDesc: 'Data Preservation',
        description: 'Specialized handling for financial reports and data sheets. Extracts tables as structured data (JSON/CSV) before embedding.',
        icon: ICONS.table_extraction,
        disabled: true
    },
    {
        id: 'ocr_enhanced',
        label: 'OCR Enhanced',
        shortDesc: 'Scanned Documents',
        description: 'Uses advanced OCR to extract text from images and scanned PDFs before applying semantic chunking.',
        icon: ICONS.ocr_enhanced,
        disabled: true
    },
    {
        id: 'hybrid_keyword',
        label: 'Hybrid Keyword',
        shortDesc: 'BM25 + Vector',
        description: 'Indexes both full-text keywords and vector embeddings. Best for technical documentation with specific jargon.',
        icon: ICONS.chunked_document,
        disabled: true
    }
];

export default function IngestionModal({
    isOpen,
    onClose,
    onShowPreview, // Callback to show preview in main content area
    backendConfig,
    isIngesting = false,
    progress = 0,
}) {
    const [selectedDb, setSelectedDb] = useState('');
    const [isCreatingNewDb, setIsCreatingNewDb] = useState(false);
    const [newDbName, setNewDbName] = useState('');
    const [isCreatingDb, setIsCreatingDb] = useState(false); // Loading state for DB creation
    const [selectedStrategy, setSelectedStrategy] = useState('embed_per_page'); // Default selection

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedDb('');
            setIsCreatingNewDb(false);
            setNewDbName('');
            setIsCreatingDb(false);
            setSelectedStrategy('chunked_document');
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

    const handleDbChange = (e) => {
        const value = e.target.value;
        if (value === '__create_new__') {
            setIsCreatingNewDb(true);
            setSelectedDb(''); // Reset selected DB ID
        } else {
            setSelectedDb(value);
        }
    };

    const handleCreateCollection = async () => {
        if (!newDbName.trim()) return;

        setIsCreatingDb(true);

        try {
            // Mock backend call
            await new Promise(resolve => setTimeout(resolve, 800));

            // Success
            toast.success(`Collection "${newDbName}" created successfully`);

            // Set as selected and exit edit mode
            setSelectedDb(newDbName);
            setIsCreatingNewDb(false);

            // Normally we'd refresh the list here, but for now we'll just proceed with the name
        } catch (e) {
            console.error(e);
            toast.error("Failed to create collection");
        } finally {
            setIsCreatingDb(false);
        }
    };

    const handleKeyDownCreate = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateCollection();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsCreatingNewDb(false);
            setNewDbName('');
        }
    };

    const availableDbs = backendConfig?.availableTargetDbs || [];
    const embeddingModels = backendConfig?.embeddingModels || [];

    // Handle showing preview in main content area
    const handleShowPreview = useCallback(() => {
        const targetDb = isCreatingNewDb ? newDbName.trim() : selectedDb;

        if (!targetDb) {
            toast.warning('Please select or create a collection first');
            return;
        }
        if (!selectedStrategy) {
            toast.warning('Please select an ingestion strategy');
            return;
        }

        onShowPreview(targetDb, selectedStrategy);
        onClose();
    }, [selectedDb, selectedStrategy, isCreatingNewDb, newDbName, onShowPreview, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-tum-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => !isIngesting && onClose()}
            ></div>

            {/* Modal Panel */}
            <div className="relative transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh] sm:w-full sm:max-w-2xl">

                {/* Header */}
                <div className="bg-gradient-to-r from-tum-blue to-tum-dark-blue px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <h3 className="text-xl font-semibold text-white tracking-tight" id="modal-title">
                                Ingest Documents
                            </h3>
                            <p className="text-tum-blue-light-4 text-xs mt-0.5 opacity-90">
                                Process and store your documents for AI retrieval
                            </p>
                        </div>
                    </div>
                    {!isIngesting && (
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus:outline-none"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-6 overflow-y-auto">
                    {/* Configuration Step */}
                    <>
                        {/* Database Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-tum-grey-3 mb-2">
                                Available Knowledge Base
                            </label>

                            {!isCreatingNewDb ? (
                                <div className="relative">
                                    <select
                                        value={selectedDb}
                                        onChange={handleDbChange}
                                        disabled={isIngesting}
                                        className="block w-full appearance-none rounded-xl border border-tum-grey-7 bg-white hover:bg-tum-grey-9 px-4 py-3 pr-8 text-tum-black shadow-sm focus:border-tum-blue focus:outline-none focus:ring-1 focus:ring-tum-blue sm:text-sm transition-all disabled:opacity-60 cursor-pointer"
                                    >
                                        <option value="">Select a destination collection...</option>
                                        <option value="__create_new__" className="font-bold text-tum-blue">
                                            + Create new collection...
                                        </option>
                                        <hr />
                                        {availableDbs.map((db) => (
                                            <option key={db.id} value={db.id}>
                                                {db.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
                                        <svg className="h-4 w-4 text-tum-grey-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="relative flex items-center">
                                        <div className="absolute left-3 text-tum-blue">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={newDbName}
                                            onChange={(e) => setNewDbName(e.target.value)}
                                            onKeyDown={handleKeyDownCreate}
                                            placeholder="Enter new collection name..."
                                            autoFocus
                                            disabled={isIngesting || isCreatingDb}
                                            className="block w-full rounded-xl border border-tum-blue bg-white px-4 py-3 pl-10 pr-20 text-tum-black shadow-sm focus:border-tum-blue focus:outline-none focus:ring-1 focus:ring-tum-blue sm:text-sm transition-all placeholder:text-tum-grey-4"
                                        />
                                        <div className="absolute right-2 flex items-center gap-1">
                                            <button
                                                onClick={handleCreateCollection}
                                                disabled={!newDbName.trim() || isIngesting || isCreatingDb}
                                                className="p-1.5 text-tum-blue hover:text-white hover:bg-tum-blue rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Create Collection"
                                            >
                                                {isCreatingDb ? (
                                                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsCreatingNewDb(false);
                                                    setNewDbName('');
                                                }}
                                                disabled={isIngesting || isCreatingDb}
                                                className="p-1.5 text-tum-grey-4 hover:text-tum-red hover:bg-tum-red/10 rounded-lg transition-colors"
                                                title="Cancel"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-tum-blue mt-1.5 ml-1 font-medium flex justify-between">
                                        <span>Creating specific collection for these documents</span>
                                        <span className="text-tum-grey-4 font-normal">Press Enter to create</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Embedding Model Selection */}
                        {embeddingModels.length > 0 && (
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-tum-grey-3 mb-2 flex justify-between">
                                    <span>Embedding Model</span>
                                    <span className="text-xs text-tum-grey-4 bg-tum-grey-8 px-2 py-0.5 rounded-full">Coming Soon</span>
                                </label>
                                <div className="relative">
                                    <select
                                        disabled
                                        className="block w-full appearance-none rounded-xl border border-tum-grey-7 bg-tum-grey-9 px-4 py-3 pr-8 text-tum-grey-4 shadow-sm cursor-not-allowed opacity-75"
                                    >
                                        {embeddingModels.map((model) => (
                                            <option key={model.id} value={model.id} disabled={model.disabled}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
                                        <svg className="h-4 w-4 text-tum-grey-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Strategy Selection */}
                        <div className="mb-2">
                            <label className="block text-sm font-semibold text-tum-grey-3 mb-3">
                                Ingestion Strategy
                            </label>
                            {/* Vertical list handles many items better than a grid */}
                            <div className="flex flex-col gap-3">
                                {INGESTION_STRATEGIES.map((strategy) => {
                                    const isSelected = selectedStrategy === strategy.id;
                                    const isDisabled = strategy.disabled;
                                    return (
                                        <button
                                            key={strategy.id}
                                            onClick={() => !isIngesting && !isDisabled && setSelectedStrategy(strategy.id)}
                                            disabled={isIngesting || isDisabled}
                                            className={`group relative flex items-start text-left rounded-xl border p-4 transition-all duration-200 outline-none
                                            ${isSelected
                                                    ? 'border-tum-blue bg-tum-blue-light-5 shadow-sm ring-1 ring-tum-blue'
                                                    : isDisabled
                                                        ? 'border-tum-grey-7 bg-tum-grey-9 opacity-60 cursor-not-allowed'
                                                        : 'border-tum-grey-7 bg-white hover:border-tum-blue/50 hover:bg-tum-grey-9 hover:shadow-sm'
                                                } ${isIngesting ? 'cursor-not-allowed opacity-70' : ''}`
                                            }
                                        >
                                            {/* Radio Indicator */}
                                            <div className="flex items-center justify-center shrink-0 mt-0.5 mr-4">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors 
                                                ${isSelected
                                                        ? 'border-tum-blue bg-tum-blue'
                                                        : isDisabled
                                                            ? 'border-tum-grey-4 bg-tum-grey-8'
                                                            : 'border-tum-grey-4 group-hover:border-tum-blue/50'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className={`font-bold text-sm ${isSelected ? 'text-tum-blue' : 'text-tum-black'}`}>
                                                        {strategy.label}
                                                    </h4>

                                                    {isDisabled ? (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-tum-grey-8 text-tum-grey-4 border border-tum-grey-7">
                                                            Coming Soon
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isSelected ? 'bg-tum-blue/10 text-tum-blue' : 'bg-tum-grey-8 text-tum-grey-4'}`}>
                                                            {strategy.shortDesc}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-xs leading-relaxed ${isSelected ? 'text-tum-dark-blue' : 'text-tum-grey-3'}`}>
                                                    {strategy.description}
                                                </p>
                                            </div>

                                            {/* Icon (Optional, can hide on small screens) */}
                                            <div className={`hidden sm:block ml-4 p-2 rounded-lg shrink-0 transition-colors 
                                            ${isSelected ? 'text-tum-blue bg-white' : 'text-tum-grey-4 bg-tum-grey-9'}
                                            ${!isDisabled && !isSelected && 'group-hover:text-tum-blue group-hover:bg-tum-blue-light-5'}
                                        `}>
                                                {strategy.icon}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                </div>

                {/* Footer / Progress */}
                <div className="bg-tum-grey-9 px-6 py-4 flex flex-col gap-4 border-t border-tum-grey-8 shrink-0">
                    {isIngesting ? (
                        <div className="w-full py-2">
                            <div className="flex justify-between text-xs font-semibold text-tum-blue mb-2">
                                <span>Processing documents...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-tum-grey-7 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-tum-blue transition-all duration-500 ease-out flex items-center justify-end"
                                    style={{ width: `${Math.max(5, progress)}%` }}
                                >
                                    <div className={`h-full w-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[spin_1s_linear_infinite]`} style={{ animation: 'progress-stripes 1s linear infinite' }} />
                                </div>
                            </div>
                            <style jsx>{`
                                @keyframes progress-stripes {
                                    from { background-position: 1rem 0; }
                                    to { background-position: 0 0; }
                                }
                            `}</style>
                        </div>
                    ) : (
                        /* Config step footer */
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-tum-black bg-white border border-tum-grey-7 hover:bg-tum-grey-9 hover:border-tum-grey-4 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShowPreview}
                                disabled={(!selectedDb && (!isCreatingNewDb || !newDbName.trim())) || !selectedStrategy}
                                className="px-6 py-2.5 rounded-xl bg-tum-blue text-white text-sm font-semibold shadow-md shadow-tum-blue/20 hover:bg-tum-dark-blue hover:shadow-lg hover:shadow-tum-blue/30 transform active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Preview Embeddings
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
