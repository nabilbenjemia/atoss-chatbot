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
import useUndoRedo from '../hooks/useUndoRedo';
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

    // Document content state with undo/redo
    const {
        state: documentState,
        update: updateDocument,
        undo,
        redo,
        reset: resetDocument,
        canUndo,
        canRedo,
    } = useUndoRedo(null);

    // UI state
    const [currentPage, setCurrentPage] = useState(1);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showIngestionModal, setShowIngestionModal] = useState(false);
    const [ingestionProgress, setIngestionProgress] = useState(0);
    const [isIngesting, setIsIngesting] = useState(false);
    const [showRegexModal, setShowRegexModal] = useState(false);
    const [runningHelper, setRunningHelper] = useState(null);

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
    const handleDragOver = useCallback(() => setIsDragging(true), []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);
    const handleDrop = useCallback(() => setIsDragging(false), []);

    // Navigation between pages
    const goToPage = useCallback((page) => {
        if (!documentState?.pages) return;
        const maxPage = documentState.pages.length;
        const newPage = Math.max(1, Math.min(page, maxPage));
        setCurrentPage(newPage);
    }, [documentState]);

    // Edit handlers
    const handleEditItem = useCallback((itemId, newContent) => {
        if (!documentState) return;

        const updatedPages = documentState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === itemId ? { ...item, content: newContent } : item
            ),
        }));

        updateDocument({ ...documentState, pages: updatedPages });
        setHasUnsavedChanges(true);
    }, [documentState, updateDocument]);

    const handleDeleteItem = useCallback((itemId) => {
        if (!documentState) return;

        const updatedPages = documentState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === itemId ? { ...item, deleted: true } : item
            ),
        }));

        updateDocument({ ...documentState, pages: updatedPages });
        setHasUnsavedChanges(true);
        toast.info('Item deleted (can be undone)');
    }, [documentState, updateDocument]);

    const handleRestoreItem = useCallback((itemId) => {
        if (!documentState) return;

        const updatedPages = documentState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === itemId ? { ...item, deleted: false } : item
            ),
        }));

        updateDocument({ ...documentState, pages: updatedPages });
        setHasUnsavedChanges(true);
        toast.info('Item restored');
    }, [documentState, updateDocument]);

    const handleClassChange = useCallback((itemId, newClass) => {
        if (!documentState) return;

        const updatedPages = documentState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
                item.id === itemId ? { ...item, classification: newClass } : item
            ),
        }));

        updateDocument({ ...documentState, pages: updatedPages });
        setHasUnsavedChanges(true);
    }, [documentState, updateDocument]);

    // Helper functions
    const handleRunHelper = useCallback(async (helperId) => {
        if (!documentState) return;

        // Handle helpers with input
        if (helperId === 'delete_regex') {
            setShowRegexModal(true);
            return;
        }

        setRunningHelper(helperId);

        try {
            let updatedPages = [...documentState.pages];
            let message = '';

            switch (helperId) {
                case 'remove_logos': {
                    // Remove all images classified as 'logo'
                    let count = 0;
                    updatedPages = updatedPages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => {
                            if (item.type === 'image' && item.classification === 'logo' && !item.deleted) {
                                count++;
                                return { ...item, deleted: true };
                            }
                            return item;
                        }),
                    }));
                    message = count > 0 ? `${count} logo(s) removed` : 'No logos found';
                    break;
                }

                case 'remove_empty': {
                    // Remove text items with empty or minimal content
                    let count = 0;
                    updatedPages = updatedPages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => {
                            if (item.type === 'text' && !item.deleted) {
                                const trimmed = item.content.trim();
                                // Empty or single character/digit
                                if (!trimmed || trimmed.length <= 1) {
                                    count++;
                                    return { ...item, deleted: true };
                                }
                            }
                            return item;
                        }),
                    }));
                    message = count > 0 ? `${count} empty item(s) removed` : 'No empty items found';
                    break;
                }

                case 'ai_image_descriptions': {
                    // Call backend helper (mocked)
                    const result = await runBackendHelper(selectedDocumentId, helperId, {});
                    if (result.success && result.modifiedItems) {
                        // Apply AI-generated descriptions
                        const modifiedMap = new Map(result.modifiedItems.map(m => [m.id, m]));
                        updatedPages = updatedPages.map((page) => ({
                            ...page,
                            items: page.items.map((item) => {
                                const modified = modifiedMap.get(item.id);
                                if (modified && modified.description) {
                                    return { ...item, description: modified.description };
                                }
                                return item;
                            }),
                        }));
                        message = result.message || 'AI descriptions generated';
                    }
                    break;
                }

                default:
                    message = 'Unknown helper';
            }

            updateDocument({ ...documentState, pages: updatedPages });
            setHasUnsavedChanges(true);
            toast.success(message);
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error('Helper failed: ' + error.message);
        } finally {
            setRunningHelper(null);
        }
    }, [documentState, selectedDocumentId, updateDocument]);

    // Handle regex delete
    const handleRegexDelete = useCallback((pattern) => {
        if (!documentState) return;

        try {
            const regex = new RegExp(pattern);
            let count = 0;

            const updatedPages = documentState.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => {
                    if (item.type === 'text' && !item.deleted && regex.test(item.content)) {
                        count++;
                        return { ...item, deleted: true };
                    }
                    return item;
                }),
            }));

            updateDocument({ ...documentState, pages: updatedPages });
            setHasUnsavedChanges(true);
            toast.success(count > 0 ? `${count} item(s) matched and deleted` : 'No matches found');
        } catch {
            toast.error('Invalid regex pattern');
        }
    }, [documentState, updateDocument]);

    // Start ingestion
    const handleStartIngestion = useCallback(async (targetDb) => {
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
        <div className="flex h-screen bg-tum-grey-20">
            {/* Left Panel - File Queue */}
            <div className="w-72 bg-tum-blue-light-4 p-4 flex flex-col rounded-r-2xl">
                <h2 className="text-lg font-bold text-tum-grey-1 mb-4">Document Ingestion</h2>

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
                <div className="mt-4">
                    <FileQueue
                        files={uploadQueue}
                        selectedDocumentId={selectedDocumentId}
                        onSelect={selectDocument}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header / Save Bar */}
                <div className="bg-white border-b border-tum-grey-7 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-tum-grey-1">
                                {documentState?.filename || 'Select a document'}
                            </h1>
                            {documentState && (
                                <p className="text-sm text-tum-grey-4">
                                    Page {currentPage} of {totalPages}
                                </p>
                            )}
                        </div>

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
            <HelperPanel
                onRunHelper={handleRunHelper}
                disabled={!documentState || isIngesting}
                runningHelper={runningHelper}
            />

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
