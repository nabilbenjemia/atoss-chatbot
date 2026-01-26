/**
 * IngestionPage
 * 
 * Admin page for document ingestion workflow:
 * 1. Upload documents (PDF)
 * 2. Review/edit extracted content
 * 3. Ingest into vector database
 * 
 * Layout: Three-panel (File Queue | Content Viewer | Helper Panel)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useBackendConfig from '../hooks/useBackendConfig';
import useCommandHistory, { Commands } from '../hooks/useCommandHistory';
import useLocalCache, { loadFromCache, clearCache, hasCache } from '../hooks/useLocalCache';
import {
    uploadDocument,
    getProcessingStatus,
    getExtractedContent,
    startIngestion,
    getIngestionStatus,
    runBackendHelper,
} from '../services/ingestionApi';
import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { mockCurrentUser, shouldUseMockAuth } from '../mocks/ingestionMocks';
import { getCurrentUser } from '../services/api';

// Import components
import {
    UploadZone,
    FileQueue,
    DOC_STATUS,
    ContentViewer,
    HelperPanel,
    IngestionModal,
    RegexInputModal,
    SaveBar,
} from '../components/ingestion';

export default function IngestionPage() {
    const navigate = useNavigate();
    const { config: backendConfig, loading: configLoading } = useBackendConfig();

    // File upload state
    const [uploadQueue, setUploadQueue] = useState([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Document content state with command-based undo/redo (memory efficient)
    const {
        state: documentState,
        execute: executeCommand,
        undo,
        redo,
        reset: resetDocument,
        canUndo,
        canRedo,
    } = useCommandHistory(null);

    // UI state
    const [currentPage, setCurrentPage] = useState(1);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showIngestionModal, setShowIngestionModal] = useState(false);
    const [ingestionProgress, setIngestionProgress] = useState(0);
    const [isIngesting, setIsIngesting] = useState(false);
    const [showRegexModal, setShowRegexModal] = useState(false);
    const [runningHelper, setRunningHelper] = useState(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitleValue, setEditingTitleValue] = useState('');

    // Sidebar state
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

    // Auto-collapse sidebars on small screens
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            // Collapse both sidebars when screen is narrow
            if (width < 768) {
                setLeftSidebarCollapsed(true);
                setRightSidebarCollapsed(true);
            } else if (width < 1024) {
                // Collapse only right sidebar on medium screens
                setRightSidebarCollapsed(true);
            }
        };

        // Check initial size
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Local cache
    useLocalCache(
        documentState ? { documentState, hasUnsavedChanges } : null,
        INGESTION_CONFIG.storage.editStateKey,
        { enabled: hasUnsavedChanges }
    );

    // Auth check (bypassed in dev mode)
    useEffect(() => {
        const checkAuth = () => {
            // TODO: Replace with real auth when available
            const user = shouldUseMockAuth() ? mockCurrentUser : getCurrentUser();

            if (!user) {
                toast.error('Please log in to access this page');
                navigate('/');
                return;
            }

            // TODO: Enable role check when backend provides user.role
            // For now, bypass role check in development
            if (!shouldUseMockAuth() && user.role !== 'admin') {
                toast.error('Admin access required');
                navigate(-1);
                return;
            }
        };

        checkAuth();
    }, [navigate]);

    // Check for cached state on mount
    useEffect(() => {
        if (hasCache(INGESTION_CONFIG.storage.editStateKey)) {
            const cached = loadFromCache(INGESTION_CONFIG.storage.editStateKey);
            if (cached && cached.documentState) {
                // Show prompt to resume
                const resume = window.confirm(
                    'You have unsaved work from a previous session. Would you like to resume?'
                );
                if (resume) {
                    resetDocument(cached.documentState);
                    setHasUnsavedChanges(cached.hasUnsavedChanges || false);
                    toast.info('Restored previous session');
                } else {
                    clearCache(INGESTION_CONFIG.storage.editStateKey);
                }
            }
        }
    }, [resetDocument]);

    // Select a document to view/edit
    const selectDocument = useCallback(async (documentId) => {
        console.log('[IngestionPage] selectDocument called', { documentId });
        try {
            const content = await getExtractedContent(documentId);
            resetDocument(content);
            setSelectedDocumentId(documentId);
            setCurrentPage(1);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to load document:', error);
            toast.error('Failed to load document content');
        }
    }, [resetDocument]);

    // Poll for processing completion
    const pollProcessingStatus = useCallback((queueId, documentId) => {
        console.log('[IngestionPage] pollProcessingStatus called', { queueId, documentId });
        const poll = async () => {
            try {
                const status = await getProcessingStatus(documentId);

                setUploadQueue((prev) =>
                    prev.map((d) =>
                        d.id === queueId
                            ? { ...d, status: status.status, progress: status.progress }
                            : d
                    )
                );

                if (status.status === 'ready') {
                    toast.success('Document ready for review');
                    // Auto-select if no document selected
                    setSelectedDocumentId((currentId) => {
                        if (!currentId) {
                            selectDocument(documentId);
                        }
                        return currentId;
                    });
                } else if (status.status === 'error') {
                    toast.error(`Processing failed: ${status.error}`);
                } else {
                    // Continue polling
                    setTimeout(poll, INGESTION_CONFIG.polling.processingStatusMs);
                }
            } catch (error) {
                console.error('Status poll failed:', error);
            }
        };

        poll();
    }, [selectDocument]);

    // Handle files selected from upload zone
    const handleFilesSelected = useCallback(async (files) => {
        console.log('[IngestionPage] 🎯 handleFilesSelected (USER ACTION)', { files: files.map(f => f.name) });
        // Add to upload queue
        const newDocs = files.map((file) => ({
            id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            filename: file.name,
            status: DOC_STATUS.QUEUED,
            progress: 0,
        }));

        setUploadQueue((prev) => [...prev, ...newDocs]);

        // Start uploading each file
        for (const doc of newDocs) {
            setUploadQueue((prev) =>
                prev.map((d) =>
                    d.id === doc.id ? { ...d, status: DOC_STATUS.UPLOADING, progress: 10 } : d
                )
            );

            try {
                const result = await uploadDocument(doc.file);

                setUploadQueue((prev) =>
                    prev.map((d) =>
                        d.id === doc.id
                            ? { ...d, documentId: result.documentId, status: DOC_STATUS.PROCESSING, progress: 30 }
                            : d
                    )
                );

                // Poll for processing status
                pollProcessingStatus(doc.id, result.documentId);
            } catch (error) {
                console.error('Upload failed:', error);
                setUploadQueue((prev) =>
                    prev.map((d) =>
                        d.id === doc.id ? { ...d, status: DOC_STATUS.ERROR, error: error.message } : d
                    )
                );
                toast.error(`Upload failed: ${doc.filename}`);
            }
        }
    }, [pollProcessingStatus]);

    // Handle drag state
    const handleDragOver = useCallback(() => { console.log('[IngestionPage] 🎯 handleDragOver (USER ACTION)'); setIsDragging(true); }, []);
    const handleDragLeave = useCallback(() => { console.log('[IngestionPage] 🎯 handleDragLeave (USER ACTION)'); setIsDragging(false); }, []);
    const handleDrop = useCallback(() => { console.log('[IngestionPage] 🎯 handleDrop (USER ACTION)'); setIsDragging(false); }, []);

    // Handle file rename
    const handleRenameFile = useCallback((docId, newFilename) => {
        console.log('[IngestionPage] 🎯 handleRenameFile (USER ACTION)', { docId, newFilename });
        setUploadQueue((prev) =>
            prev.map((d) =>
                d.id === docId ? { ...d, filename: newFilename } : d
            )
        );
        // Also update documentState filename if it's the currently selected document
        if (documentState) {
            const doc = uploadQueue.find(d => d.id === docId);
            if (doc && doc.documentId === selectedDocumentId) {
                executeCommand(Commands.renameDocument(newFilename, documentState.filename));
            }
        }
        toast.success('File renamed');
    }, [documentState, uploadQueue, selectedDocumentId, executeCommand]);

    // Navigation between pages
    const goToPage = useCallback((page) => {
        console.log('[IngestionPage] 🎯 goToPage (USER ACTION)', { page });
        if (!documentState?.pages) return;
        const maxPage = documentState.pages.length;
        const newPage = Math.max(1, Math.min(page, maxPage));
        setCurrentPage(newPage);
    }, [documentState]);

    // Edit handlers - using Command Pattern for memory efficiency
    const handleEditItem = useCallback((itemId, newContent) => {
        console.log('[IngestionPage] 🎯 handleEditItem (USER ACTION)', { itemId, newContent: newContent?.substring(0, 50) + '...' });
        if (!documentState) return;

        // Find the old content for the undo operation
        let oldContent = '';
        for (const page of documentState.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldContent = item.content;
                break;
            }
        }

        executeCommand(Commands.editItem(itemId, newContent, oldContent));
        setHasUnsavedChanges(true);
    }, [documentState, executeCommand]);

    const handleDeleteItem = useCallback((itemId) => {
        console.log('[IngestionPage] 🎯 handleDeleteItem (USER ACTION)', { itemId });
        if (!documentState) return;

        executeCommand(Commands.deleteItem(itemId));
        setHasUnsavedChanges(true);
        toast.info('Item deleted (can be undone)');
    }, [documentState, executeCommand]);

    const handleRestoreItem = useCallback((itemId) => {
        console.log('[IngestionPage] 🎯 handleRestoreItem (USER ACTION)', { itemId });
        if (!documentState) return;

        executeCommand(Commands.restoreItem(itemId));
        setHasUnsavedChanges(true);
        toast.info('Item restored');
    }, [documentState, executeCommand]);

    const handleClassChange = useCallback((itemId, newClass) => {
        console.log('[IngestionPage] 🎯 handleClassChange (USER ACTION)', { itemId, newClass });
        if (!documentState) return;

        // Find the old classification for undo
        let oldClass = '';
        for (const page of documentState.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldClass = item.classification || '';
                break;
            }
        }

        executeCommand(Commands.changeClass(itemId, newClass, oldClass));
        setHasUnsavedChanges(true);
    }, [documentState, executeCommand]);

    // Helper functions - using Command Pattern for batch operations
    const handleRunHelper = useCallback(async (helperId) => {
        console.log('[IngestionPage] 🎯 handleRunHelper (USER ACTION)', { helperId });
        if (!documentState) return;

        // Handle helpers with input
        if (helperId === 'delete_regex') {
            setShowRegexModal(true);
            return;
        }

        setRunningHelper(helperId);

        try {
            let message = '';

            switch (helperId) {
                case 'remove_logos': {
                    // Collect all logo item IDs
                    const logoItemIds = [];
                    for (const page of documentState.pages) {
                        for (const item of page.items) {
                            if (item.type === 'image' && item.classification === 'logo' && !item.deleted) {
                                logoItemIds.push(item.id);
                            }
                        }
                    }

                    if (logoItemIds.length > 0) {
                        executeCommand(Commands.batchDelete(logoItemIds));
                        setHasUnsavedChanges(true);
                    }
                    message = logoItemIds.length > 0 ? `${logoItemIds.length} logo(s) removed` : 'No logos found';
                    break;
                }

                case 'remove_empty': {
                    // Collect all empty text item IDs
                    const emptyItemIds = [];
                    for (const page of documentState.pages) {
                        for (const item of page.items) {
                            if (item.type === 'text' && !item.deleted) {
                                const trimmed = item.content.trim();
                                if (!trimmed || trimmed.length <= 1) {
                                    emptyItemIds.push(item.id);
                                }
                            }
                        }
                    }

                    if (emptyItemIds.length > 0) {
                        executeCommand(Commands.batchDelete(emptyItemIds));
                        setHasUnsavedChanges(true);
                    }
                    message = emptyItemIds.length > 0 ? `${emptyItemIds.length} empty item(s) removed` : 'No empty items found';
                    break;
                }

                case 'ai_image_descriptions': {
                    // Call backend helper (mocked)
                    const result = await runBackendHelper(selectedDocumentId, helperId, {});
                    if (result.success && result.modifiedItems) {
                        // Build batch update changes
                        const changes = result.modifiedItems
                            .filter(m => m.description)
                            .map(m => {
                                // Find old description
                                let oldDescription = '';
                                for (const page of documentState.pages) {
                                    const item = page.items.find(i => i.id === m.id);
                                    if (item) {
                                        oldDescription = item.description || '';
                                        break;
                                    }
                                }
                                return {
                                    itemId: m.id,
                                    newValues: { description: m.description },
                                    oldValues: { description: oldDescription },
                                };
                            });

                        if (changes.length > 0) {
                            executeCommand(Commands.batchUpdate(changes));
                            setHasUnsavedChanges(true);
                        }
                        message = result.message || 'AI descriptions generated';
                    }
                    break;
                }

                default:
                    message = 'Unknown helper';
            }

            toast.success(message);
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error('Helper failed: ' + error.message);
        } finally {
            setRunningHelper(null);
        }
    }, [documentState, selectedDocumentId, executeCommand]);

    // Handle regex delete - using batch delete command
    const handleRegexDelete = useCallback((pattern) => {
        console.log('[IngestionPage] 🎯 handleRegexDelete (USER ACTION)', { pattern });
        if (!documentState) return;

        try {
            const regex = new RegExp(pattern);
            const matchingItemIds = [];

            for (const page of documentState.pages) {
                for (const item of page.items) {
                    if (item.type === 'text' && !item.deleted && regex.test(item.content)) {
                        matchingItemIds.push(item.id);
                    }
                }
            }

            if (matchingItemIds.length > 0) {
                executeCommand(Commands.batchDelete(matchingItemIds));
                setHasUnsavedChanges(true);
            }
            toast.success(matchingItemIds.length > 0 ? `${matchingItemIds.length} item(s) matched and deleted` : 'No matches found');
        } catch {
            toast.error('Invalid regex pattern');
        }
    }, [documentState, executeCommand]);

    // Start ingestion
    const handleStartIngestion = useCallback(async (targetDb) => {
        console.log('[IngestionPage] 🎯 handleStartIngestion (USER ACTION)', { targetDb, documentId: selectedDocumentId });
        if (!targetDb || !documentState) return;

        setIsIngesting(true);
        setIngestionProgress(0);

        try {
            const result = await startIngestion(
                selectedDocumentId,
                targetDb,
                { pages: documentState.pages }
            );

            // Poll for ingestion status
            const pollIngestion = async () => {
                const status = await getIngestionStatus(result.jobId);
                setIngestionProgress(status.progress);

                if (status.status === 'completed') {
                    setIsIngesting(false);
                    setShowIngestionModal(false);
                    toast.success('Document ingested successfully!');
                    clearCache(INGESTION_CONFIG.storage.editStateKey);
                    setHasUnsavedChanges(false);

                    // Update queue status
                    setUploadQueue((prev) =>
                        prev.map((d) =>
                            d.documentId === selectedDocumentId
                                ? { ...d, status: DOC_STATUS.COMPLETED }
                                : d
                        )
                    );
                } else if (status.status === 'failed') {
                    setIsIngesting(false);
                    toast.error(`Ingestion failed: ${status.error}`);
                } else {
                    setTimeout(pollIngestion, INGESTION_CONFIG.polling.ingestionStatusMs);
                }
            };

            pollIngestion();
        } catch (error) {
            console.error('Ingestion failed:', error);
            setIsIngesting(false);
            toast.error('Failed to start ingestion');
        }
    }, [documentState, selectedDocumentId]);

    // Save changes (mark as saved locally)
    const handleSave = useCallback(() => {
        console.log('[IngestionPage] 🎯 handleSave (USER ACTION)');
        setHasUnsavedChanges(false);
        toast.success('Changes saved');
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    undo();
                    setHasUnsavedChanges(true);
                }
            }
            // Ctrl/Cmd + Shift + Z = Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (canRedo) {
                    redo();
                    setHasUnsavedChanges(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // Warn on navigation with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Get available image classes from backend config
    const availableClasses = backendConfig?.availableImageClasses || [];
    const totalPages = documentState?.pages?.length || 0;

    return (
        <div className="flex h-screen bg-tum-blue-light-5 overflow-hidden font-display">
            {/* Left Panel - File Queue */}
            <div
                className={`
                    ${leftSidebarCollapsed ? 'w-12' : 'w-56 lg:w-64'} 
                    bg-tum-blue-light-4 flex flex-col border-r border-tum-grey-7 rounded-r-2xl
                    transition-all duration-300 ease-in-out flex-shrink-0
                `}
            >
                {/* Header with toggle */}
                <div className={`p-4 flex items-center ${leftSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!leftSidebarCollapsed && (
                        <h2 className="text-lg font-bold text-tum-blue">Document Ingestion</h2>
                    )}
                    <button
                        onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
                        className="w-8 h-8 bg-tum-white/50 border border-tum-grey-7
                            flex items-center justify-center rounded-lg
                            hover:bg-tum-white transition-colors"
                        title={leftSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <span className="text-sm text-tum-black font-bold">
                            {leftSidebarCollapsed ? '»' : '«'}
                        </span>
                    </button>
                </div>

                {!leftSidebarCollapsed && (
                    <div className="px-4 pb-4 flex flex-col flex-1 overflow-hidden pt-4">

                        {/* Upload Zone */}
                        <UploadZone
                            onFilesSelected={handleFilesSelected}
                            disabled={isIngesting}
                            isDragging={isDragging}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        />

                        {/* File Queue */}
                        <div className="mt-4 flex-1 overflow-y-auto">
                            <FileQueue
                                files={uploadQueue}
                                selectedDocumentId={selectedDocumentId}
                                onSelect={selectDocument}
                                onRename={handleRenameFile}
                            />
                        </div>
                    </div>
                )}

                {/* Collapsed state icon */}
                {leftSidebarCollapsed && (
                    <div className="flex flex-col items-center pt-4">
                        <span className="text-2xl mb-2" title="Documents">📄</span>
                        <span className="text-xs text-tum-grey-3">
                            {uploadQueue.length > 0 && `${uploadQueue.length}`}
                        </span>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header / Save Bar */}
                <div className="bg-white border-b border-tum-grey-7 px-6 py-4">
                    {/* Title row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                            {documentState ? (
                                isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={editingTitleValue}
                                        onChange={(e) => setEditingTitleValue(e.target.value)}
                                        onBlur={() => {
                                            const trimmed = editingTitleValue.trim();
                                            if (trimmed && trimmed !== documentState.filename) {
                                                // Update document state using command
                                                executeCommand(Commands.renameDocument(trimmed, documentState.filename));
                                                setHasUnsavedChanges(true);
                                                // Update upload queue
                                                const doc = uploadQueue.find(d => d.documentId === selectedDocumentId);
                                                if (doc) {
                                                    setUploadQueue((prev) =>
                                                        prev.map((d) =>
                                                            d.id === doc.id ? { ...d, filename: trimmed } : d
                                                        )
                                                    );
                                                }
                                            }
                                            setIsEditingTitle(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.target.blur();
                                            } else if (e.key === 'Escape') {
                                                setEditingTitleValue(documentState.filename);
                                                setIsEditingTitle(false);
                                            }
                                        }}
                                        autoFocus
                                        className="w-full text-xl font-bold text-tum-black bg-white border border-tum-blue 
                                            px-3 py-2 focus:outline-none focus:ring-1 focus:ring-tum-blue"
                                    />
                                ) : (
                                    <h1
                                        className="text-xl font-bold text-tum-black cursor-text hover:bg-tum-blue-light-5 
                                            px-3 py-2 -mx-3 -my-2 transition-colors border border-transparent hover:border-tum-grey-7"
                                        onClick={() => {
                                            setEditingTitleValue(documentState.filename);
                                            setIsEditingTitle(true);
                                        }}
                                        title="Click to edit filename"
                                    >
                                        {documentState.filename}
                                    </h1>
                                )
                            ) : (
                                <h1 className="text-xl font-bold text-tum-grey-4 px-3 py-2 -mx-3 -my-2">
                                    Select a document
                                </h1>
                            )}
                        </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between">
                        {documentState && (
                            <p className="text-sm text-tum-grey-4">
                                Page {currentPage} of {totalPages}
                            </p>
                        )}
                        {!documentState && <div />}

                        <SaveBar
                            hasUnsavedChanges={hasUnsavedChanges}
                            onSave={handleSave}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onUndo={() => { undo(); setHasUnsavedChanges(true); }}
                            onRedo={() => { redo(); setHasUnsavedChanges(true); }}
                            onIngest={() => setShowIngestionModal(true)}
                            canIngest={!!documentState && !isIngesting}
                        />
                    </div>
                </div>

                {/* Content Viewer */}
                {configLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-tum-grey-4">Loading configuration...</div>
                    </div>
                ) : (
                    <ContentViewer
                        document={documentState}
                        currentPage={currentPage}
                        onPageChange={goToPage}
                        onEditItem={handleEditItem}
                        onDeleteItem={handleDeleteItem}
                        onRestoreItem={handleRestoreItem}
                        onClassChange={handleClassChange}
                        availableClasses={availableClasses}
                    />
                )}
            </main>

            {/* Right Panel - Helpers */}
            <div
                className={`
                    ${rightSidebarCollapsed ? 'w-12' : 'w-48 lg:w-56'} 
                    bg-white border-l border-tum-grey-7 flex flex-col
                    transition-all duration-300 ease-in-out flex-shrink-0
                `}
            >
                {/* Header with toggle */}
                <div className={`p-4 flex items-center ${rightSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-tum-grey-7`}>
                    <button
                        onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
                        className="w-8 h-8 bg-tum-blue-light-5 border border-tum-grey-7
                            flex items-center justify-center
                            hover:bg-tum-blue-light-3 transition-colors"
                        title={rightSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <span className="text-sm text-tum-blue font-bold">
                            {rightSidebarCollapsed ? '«' : '»'}
                        </span>
                    </button>
                    {!rightSidebarCollapsed && (
                        <h3 className="text-sm font-semibold text-tum-blue">Helpers</h3>
                    )}
                </div>

                {!rightSidebarCollapsed && (
                    <HelperPanel
                        onRunHelper={handleRunHelper}
                        disabled={!documentState || isIngesting}
                        runningHelper={runningHelper}
                    />
                )}

                {/* Collapsed state icon */}
                {rightSidebarCollapsed && (
                    <div className="flex flex-col items-center pt-4">
                        <span className="text-2xl" title="Helpers">🛠️</span>
                    </div>
                )}
            </div>

            {/* Ingestion Modal */}
            <IngestionModal
                isOpen={showIngestionModal}
                onClose={() => setShowIngestionModal(false)}
                onConfirm={handleStartIngestion}
                backendConfig={backendConfig}
                isIngesting={isIngesting}
                progress={ingestionProgress}
            />

            {/* Regex Input Modal */}
            <RegexInputModal
                isOpen={showRegexModal}
                onClose={() => setShowRegexModal(false)}
                onConfirm={handleRegexDelete}
            />
        </div>
    );
}
