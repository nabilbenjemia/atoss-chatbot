/**
 * IngestionPage (Refactored)
 * 
 * Admin page for document ingestion workflow:
 * 1. Upload documents (PDF)
 * 2. Review/edit extracted content
 * 3. Ingest into vector database
 * 
 * Architecture:
 * - Uses Context + Reducer pattern from ADR-002
 * - State managed by IngestionProvider
 * - Components access state via domain-specific hooks
 * - This component is now layout-only, orchestrating child components
 * 
 * Layout: Three-panel (File Queue | Content Viewer | Helper Panel)
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 * @see doc/ingestion/REDUCER.md for state management documentation
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Context and hooks
import {
    IngestionProvider,
    useFileQueue,
    useDocument,
    usePreview,
    useUI,
    useIngestionActions,
    useTotalPages,
    DOC_STATUS,
    CONTENT_TYPE,
    MODAL_TYPES,
} from '../context/ingestion';

// External hooks
import useBackendConfig from '../hooks/useBackendConfig';
import useCommandHistory, { Commands } from '../hooks/useCommandHistory';
import useLocalCache, { loadFromCache, clearCache, hasCache } from '../hooks/useLocalCache';

// API services
import {
    uploadDocument,
    runBackendHelper,
    previewEmbeddings,
} from '../services/ingestionApi';

// Config and utilities
import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { mockCurrentUser, shouldUseMockAuth, convertPreviewToIngestedFormat, delay } from '../mocks/ingestionMocks';
import { getCurrentUser } from '../services/api';
import {
    getUploadedFiles,
    addUploadedFile,
    removeUploadedFile,
    saveFileContent,
    getFileContent,
    updateUploadedFile,
    getIngestedFiles,
    createIngestedFile,
    removeIngestedFile,
    saveFileHistory,
    getFileHistory,
} from '../utils/fileCacheManager';

// Components
import {
    UploadZone,
    FileQueue,
    ContentViewer,
    HelperPanel,
    IngestionModal,
    RegexInputModal,
    SaveBar,
    EmbeddingPreviewViewer,
    CacheManagement,
    HelperFileSelectModal,
} from '../components/ingestion';

/**
 * Main IngestionPage Component
 * Wrapped with IngestionProvider for state management
 */
export default function IngestionPage() {
    return (
        <IngestionProvider>
            <IngestionPageContent />
        </IngestionProvider>
    );
}

/**
 * IngestionPage Content
 * The actual page content that uses the context
 */
function IngestionPageContent() {
    const navigate = useNavigate();
    const { config: backendConfig, loading: configLoading } = useBackendConfig();

    // Get state from context
    const { uploadQueue, ingestedFiles, selectedDocumentId } = useFileQueue();
    const { documentState, currentPage, contentType, storedEmbeddings } = useDocument();
    const { isPreviewMode, isLoadingPreview, embeddingPreview, previewConfig, previewDocumentIds } = usePreview();
    const {
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        rightSidebarStateBeforePreview,
        isDragging,
        multiSelectMode,
        checkedDocumentIds,
        isEditingTitle,
        editingTitleValue,
        isIngesting,
        ingestionProgress,
        runningHelper,
        pendingHelper,
        activeModal,
    } = useUI();

    // Get actions from context
    const actions = useIngestionActions();

    // Document content state with command-based undo/redo (memory efficient)
    const {
        state: commandDocumentState,
        execute: executeCommand,
        undo,
        redo,
        reset: resetCommandDocument,
        restore: restoreCommandDocument,
        getFullState: getDocumentFullState,
        canUndo,
        canRedo,
    } = useCommandHistory(null);

    // Sync command history state with context
    useEffect(() => {
        if (commandDocumentState) {
            actions.modifyDocument(commandDocumentState);
        }
    }, [commandDocumentState, actions]);

    const totalPages = useTotalPages();

    // Local cache for editor state (session recovery)
    useLocalCache(
        documentState ? { documentState } : null,
        INGESTION_CONFIG.storage.editStateKey,
        { enabled: !!documentState }
    );

    // Auto-collapse sidebars on small screens (only on mount)
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            // This runs only on mount, so we read from the DOM state
            if (width < 768) {
                actions.toggleLeftSidebar();
                actions.toggleRightSidebar();
            } else if (width < 1024) {
                actions.toggleRightSidebar();
            }
        };
        // Initial check on mount only
        const width = window.innerWidth;
        if (width < 768 || width < 1024) {
            handleResize();
        }
        // Note: We don't add resize listener here to avoid dependency issues
        // The sidebars have toggle buttons for manual adjustment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-save document content and command history to cache
    useEffect(() => {
        if (documentState && selectedDocumentId) {
            saveFileContent(selectedDocumentId, documentState);
            updateUploadedFile(selectedDocumentId, { filename: documentState.filename });
            const fullState = getDocumentFullState();
            saveFileHistory(selectedDocumentId, fullState);
        }
    }, [documentState, selectedDocumentId, getDocumentFullState]);

    // Auth check
    useEffect(() => {
        const checkAuth = () => {
            const user = shouldUseMockAuth() ? mockCurrentUser : getCurrentUser();
            if (!user) {
                toast.error('Please log in to access this page');
                navigate('/');
                return;
            }
            if (!shouldUseMockAuth() && user.role !== 'admin') {
                toast.error('Admin access required');
                navigate(-1);
            }
        };
        checkAuth();
    }, [navigate]);

    // Check for cached state on mount
    useEffect(() => {
        if (hasCache(INGESTION_CONFIG.storage.editStateKey)) {
            const cached = loadFromCache(INGESTION_CONFIG.storage.editStateKey);
            if (cached?.documentState) {
                const resume = window.confirm(
                    'You have unsaved work from a previous session. Would you like to resume?'
                );
                if (resume) {
                    resetCommandDocument(cached.documentState);
                    toast.info('Restored previous session');
                } else {
                    clearCache(INGESTION_CONFIG.storage.editStateKey);
                }
            }
        }

        // Load uploaded files from cache
        const cachedUploadedFiles = getUploadedFiles();
        if (cachedUploadedFiles.length > 0) {
            const restoredQueue = cachedUploadedFiles.map(f => ({
                id: f.id || `cached_${f.documentId}`,
                documentId: f.documentId,
                filename: f.filename,
                status: f.status || DOC_STATUS.READY,
                progress: 100,
            }));
            actions.restoreFilesFromCache(restoredQueue);
        }

        // Load ingested files from cache
        const cachedIngestedFiles = getIngestedFiles();
        actions.loadIngestedFiles(cachedIngestedFiles);
    }, [resetCommandDocument, actions]);

    // Select a document to view/edit
    const selectDocument = useCallback(async (documentId) => {
        if (isPreviewMode) {
            if (previewDocumentIds.has(documentId)) {
                const docContent = getFileContent(documentId);
                if (!docContent) {
                    toast.error('Could not load document content');
                    return;
                }
                try {
                    const preview = await previewEmbeddings(previewConfig.strategy, docContent);
                    actions.switchPreviewFile(documentId, preview);
                } catch (error) {
                    console.error('Failed to generate preview:', error);
                    toast.error('Failed to generate embedding preview');
                }
            }
            return;
        }

        // Check for stored embeddings
        const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
        const storedEmb = loadFromCache(embeddingKey);
        if (storedEmb) {
            actions.setStoredEmbeddings(storedEmb, documentId);
            resetCommandDocument(null);
            return;
        }

        // Load from cache
        const cachedContent = getFileContent(documentId);
        if (cachedContent) {
            const cachedHistory = getFileHistory(documentId);
            if (cachedHistory) {
                restoreCommandDocument({
                    past: cachedHistory.past || [],
                    present: cachedContent,
                    future: cachedHistory.future || [],
                });
            } else {
                resetCommandDocument(cachedContent);
            }
            actions.loadDocument(cachedContent, documentId);
            return;
        }

        console.warn('[IngestionPage] No cached content found for', documentId);
        toast.error('Document content not found. Please re-upload the file.');
    }, [isPreviewMode, previewDocumentIds, previewConfig.strategy, actions, resetCommandDocument, restoreCommandDocument]);

    // Handle files selected from upload zone
    const handleFilesSelected = useCallback(async (files) => {
        const newDocs = files.map((file) => ({
            id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            filename: file.name,
        }));

        for (const doc of newDocs) {
            actions.startFileUpload(doc.id, doc.file, doc.filename);
            actions.updateFileProgress(doc.id, DOC_STATUS.UPLOADING, 10);

            try {
                const result = await uploadDocument(doc.file);
                if (!result.success || !result.content) {
                    throw new Error(result.error || 'Failed to process document');
                }

                const documentId = result.content.documentId;
                saveFileContent(documentId, result.content);
                actions.completeFileUpload(doc.id, documentId);
                addUploadedFile({
                    id: doc.id,
                    documentId,
                    filename: doc.filename,
                    status: DOC_STATUS.READY,
                });
                toast.success(`Document ready: ${doc.filename}`);

                // Auto-select if no document selected
                if (!selectedDocumentId) {
                    selectDocument(documentId);
                }
            } catch (error) {
                console.error('Upload failed:', error);
                actions.failFileUpload(doc.id, error.message);
                toast.error(`Upload failed: ${doc.filename}`);
            }
        }
    }, [actions, selectedDocumentId, selectDocument]);

    // Navigation between pages
    const goToPage = useCallback((page) => {
        if (!documentState?.pages) return;
        const maxPage = documentState.pages.length;
        const newPage = Math.max(1, Math.min(page, maxPage));
        actions.changePage(newPage);
    }, [documentState, actions]);

    // Edit handlers
    const handleEditItem = useCallback((itemId, newContent) => {
        if (!documentState) return;
        let oldContent = '';
        for (const page of documentState.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldContent = item.content;
                break;
            }
        }
        executeCommand(Commands.editItem(itemId, newContent, oldContent));
    }, [documentState, executeCommand]);

    const handleDeleteItem = useCallback((itemId) => {
        if (!documentState) return;
        executeCommand(Commands.deleteItem(itemId));
        toast.info('Item deleted (can be undone)');
    }, [documentState, executeCommand]);

    const handleRestoreItem = useCallback((itemId) => {
        if (!documentState) return;
        executeCommand(Commands.restoreItem(itemId));
        toast.info('Item restored');
    }, [documentState, executeCommand]);

    const handleClassChange = useCallback((itemId, newClass) => {
        if (!documentState) return;
        let oldClass = '';
        for (const page of documentState.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldClass = item.classification || '';
                break;
            }
        }
        executeCommand(Commands.changeClass(itemId, newClass, oldClass));
    }, [documentState, executeCommand]);

    // Helper functions
    const handleRunHelper = useCallback(async (helperId) => {
        const allHelpers = [...INGESTION_CONFIG.helpers.local, ...INGESTION_CONFIG.helpers.backend];
        const helper = allHelpers.find(h => h.id === helperId);
        actions.setPendingHelper(helper || { id: helperId, label: helperId });
        actions.openHelperFileSelectModal();
    }, [actions]);

    const executeHelperOnFiles = useCallback(async (selectedDocumentIds) => {
        if (!pendingHelper || selectedDocumentIds.length === 0) {
            actions.closeModal();
            actions.clearPendingHelper();
            return;
        }

        const helperId = pendingHelper.id;
        actions.closeModal();

        if (helperId === 'delete_regex') {
            actions.openRegexModal();
            actions.clearPendingHelper();
            return;
        }

        if (!documentState) {
            toast.warning('No document loaded to apply helper');
            actions.clearPendingHelper();
            return;
        }

        actions.startHelper(helperId);

        try {
            let message = '';

            switch (helperId) {
                case 'remove_logos': {
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
                    }
                    message = logoItemIds.length > 0 ? `${logoItemIds.length} logo(s) removed` : 'No logos found';
                    break;
                }

                case 'remove_empty': {
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
                    }
                    message = emptyItemIds.length > 0 ? `${emptyItemIds.length} empty item(s) removed` : 'No empty items found';
                    break;
                }

                case 'ai_image_descriptions': {
                    const result = await runBackendHelper(helperId, documentState, {});
                    if (result.success && result.modifiedItems) {
                        const changes = result.modifiedItems
                            .filter(m => m.description)
                            .map(m => {
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
                        }
                        message = result.message || 'AI descriptions generated';
                    }
                    break;
                }

                default:
                    message = 'Unknown helper';
            }

            toast.success(message);
            actions.completeHelper();
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error('Helper failed: ' + error.message);
            actions.failHelper();
        }
        actions.clearPendingHelper();
    }, [documentState, executeCommand, pendingHelper, actions]);

    const handleRegexDelete = useCallback((pattern) => {
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
            }
            toast.success(matchingItemIds.length > 0 ? `${matchingItemIds.length} item(s) matched and deleted` : 'No matches found');
        } catch {
            toast.error('Invalid regex pattern');
        }
    }, [documentState, executeCommand]);

    // Start ingestion - shows preview first
    const handleStartIngestion = useCallback(async (targetDb, strategy) => {
        const documentsToPreview = checkedDocumentIds.size > 0
            ? [...checkedDocumentIds]
            : selectedDocumentId ? [selectedDocumentId] : [];

        if (!targetDb || !strategy || documentsToPreview.length === 0) {
            toast.warning('No files selected for ingestion');
            return;
        }

        actions.closeModal();
        actions.startPreview(targetDb, strategy, documentsToPreview, rightSidebarCollapsed);

        const firstDocId = documentsToPreview[0];
        const firstDocContent = firstDocId === selectedDocumentId
            ? documentState
            : getFileContent(firstDocId);

        if (!firstDocContent) {
            toast.error('Could not load document content');
            actions.failPreview(rightSidebarCollapsed);
            return;
        }

        actions.selectFile(firstDocId);

        try {
            const preview = await previewEmbeddings(strategy, firstDocContent);
            actions.setPreviewGenerated(preview);
        } catch (error) {
            console.error('Failed to generate preview:', error);
            toast.error('Failed to generate embedding preview');
            actions.failPreview(rightSidebarCollapsed);
        }
    }, [documentState, selectedDocumentId, checkedDocumentIds, rightSidebarCollapsed, actions]);

    const handleCancelPreview = useCallback(() => {
        actions.cancelPreview(rightSidebarStateBeforePreview);
    }, [actions, rightSidebarStateBeforePreview]);

    const handleConfirmIngestion = useCallback(async () => {
        const { targetDb, strategy } = previewConfig;
        if (!targetDb || !strategy || !embeddingPreview) return;

        actions.startIngestion();

        try {
            await delay(1000);
            actions.updateIngestionProgress(100);

            const ingestedData = convertPreviewToIngestedFormat(embeddingPreview);
            const currentFile = uploadQueue.find(f => f.documentId === selectedDocumentId);

            const ingestedEntry = createIngestedFile(
                selectedDocumentId,
                strategy,
                ingestedData,
                currentFile || { documentId: selectedDocumentId, filename: 'Unknown' }
            );

            clearCache(INGESTION_CONFIG.storage.editStateKey);

            actions.completeIngestion(
                selectedDocumentId,
                ingestedEntry,
                ingestedData,
                rightSidebarStateBeforePreview
            );

            // Update local ingested files list
            actions.loadIngestedFiles(getIngestedFiles());

            toast.success(`Document ingested with "${strategy}" strategy!`);
        } catch (error) {
            console.error('Ingestion failed:', error);
            actions.failIngestion();
            toast.error('Failed to ingest document');
        }
    }, [embeddingPreview, selectedDocumentId, previewConfig, rightSidebarStateBeforePreview, uploadQueue, actions]);

    const handleConfirmIngestionAll = useCallback(async () => {
        await handleConfirmIngestion();
        toast.success(`All ${previewDocumentIds.size} file(s) ingested successfully!`);
    }, [handleConfirmIngestion, previewDocumentIds]);

    // Multi-select handlers
    const handleCheckDocument = useCallback((documentId) => {
        actions.checkDocument(documentId);
    }, [actions]);

    const toggleMultiSelectMode = useCallback(() => {
        actions.toggleMultiSelect();
    }, [actions]);

    const handleRemoveFromPreview = useCallback((documentId) => {
        actions.removePreviewFile(documentId);
        if (previewDocumentIds.size <= 1) {
            toast.info('Preview cancelled - no files remaining');
        }
    }, [actions, previewDocumentIds.size]);

    const handleRemoveFromContent = useCallback((documentId) => {
        actions.removeFile(documentId);
        removeUploadedFile(documentId);
        if (documentId === selectedDocumentId) {
            resetCommandDocument(null);
        }
        toast.info('File removed');
    }, [actions, selectedDocumentId, resetCommandDocument]);

    const handleRemoveIngestedFile = useCallback((ingestedId) => {
        removeIngestedFile(ingestedId);
        actions.removeIngestedFile(ingestedId);
        actions.loadIngestedFiles(getIngestedFiles());
        toast.info('Ingested file removed from cache');
    }, [actions]);

    const handleCacheCleared = useCallback(({ all, types }) => {
        actions.clearCache(all, types);
        actions.loadIngestedFiles(getIngestedFiles());
        resetCommandDocument(null);
    }, [actions, resetCommandDocument]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (canRedo) redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // Title editing handlers
    const handleTitleClick = useCallback(() => {
        if (documentState) {
            actions.startTitleEditing(documentState.filename);
        }
    }, [documentState, actions]);

    const handleTitleBlur = useCallback(() => {
        const trimmed = editingTitleValue.trim();
        if (trimmed && trimmed !== documentState?.filename) {
            executeCommand(Commands.renameDocument(trimmed, documentState.filename));
            actions.renameFile(selectedDocumentId, trimmed);
        }
        actions.endTitleEditing();
    }, [editingTitleValue, documentState, executeCommand, actions, selectedDocumentId]);

    const availableClasses = backendConfig?.availableImageClasses || [];

    return (
        <div className="flex h-screen bg-tum-blue-light-5 overflow-hidden font-display">
            {/* Left Panel - File Queue */}
            <LeftSidebar
                collapsed={leftSidebarCollapsed}
                onToggle={actions.toggleLeftSidebar}
                uploadQueue={uploadQueue}
                ingestedFiles={ingestedFiles}
                selectedDocumentId={selectedDocumentId}
                checkedDocumentIds={checkedDocumentIds}
                onSelect={selectDocument}
                onCheck={handleCheckDocument}
                multiSelectMode={multiSelectMode}
                isPreviewMode={isPreviewMode}
                previewDocumentIds={previewDocumentIds}
                onRemoveFromPreview={handleRemoveFromPreview}
                onRemoveFromContent={handleRemoveFromContent}
                onRemoveIngestedFile={handleRemoveIngestedFile}
                contentType={contentType}
                isDragging={isDragging}
                isIngesting={isIngesting}
                onFilesSelected={handleFilesSelected}
                onDragOver={() => actions.setDragging(true)}
                onDragLeave={() => actions.setDragging(false)}
                onDrop={() => actions.setDragging(false)}
                onToggleMultiSelect={toggleMultiSelectMode}
                onOpenCacheManagement={() => actions.openCacheManagementModal()}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header / Save Bar */}
                {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                    <ContentHeader
                        documentState={documentState}
                        isEditingTitle={isEditingTitle}
                        editingTitleValue={editingTitleValue}
                        onTitleChange={(value) => actions.startTitleEditing(value)}
                        onTitleClick={handleTitleClick}
                        onTitleBlur={handleTitleBlur}
                        onTitleKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            else if (e.key === 'Escape') actions.endTitleEditing();
                        }}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                        onIngest={() => actions.openIngestionModal()}
                        canIngest={!!documentState && !isIngesting && !isPreviewMode}
                    />
                )}

                {/* Content Viewer */}
                {configLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-tum-grey-4">Loading configuration...</div>
                    </div>
                ) : isPreviewMode ? (
                    <EmbeddingPreviewViewer
                        preview={embeddingPreview}
                        isLoading={isLoadingPreview}
                        onCancel={handleCancelPreview}
                        onConfirm={handleConfirmIngestion}
                        onConfirmAll={handleConfirmIngestionAll}
                        isMultiFile={previewDocumentIds.size > 1}
                        totalFilesInPreview={previewDocumentIds.size}
                    />
                ) : contentType === CONTENT_TYPE.EMBEDDING && storedEmbeddings ? (
                    <EmbeddingPreviewViewer
                        preview={storedEmbeddings}
                        isLoading={false}
                        readOnly={true}
                    />
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
            {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                <RightSidebar
                    collapsed={rightSidebarCollapsed}
                    onToggle={actions.toggleRightSidebar}
                    onRunHelper={handleRunHelper}
                    disabled={!documentState || isIngesting}
                    runningHelper={runningHelper}
                />
            )}

            {/* Modals */}
            <IngestionModal
                isOpen={activeModal === MODAL_TYPES.INGESTION}
                onClose={actions.closeModal}
                onShowPreview={handleStartIngestion}
                backendConfig={backendConfig}
                isIngesting={isIngesting}
                progress={ingestionProgress}
            />

            <RegexInputModal
                isOpen={activeModal === MODAL_TYPES.REGEX}
                onClose={actions.closeModal}
                onConfirm={handleRegexDelete}
            />

            {activeModal === MODAL_TYPES.CACHE_MANAGEMENT && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-tum-black/40 backdrop-blur-sm"
                        onClick={actions.closeModal}
                    />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                        <CacheManagement
                            onClose={actions.closeModal}
                            onCacheCleared={handleCacheCleared}
                        />
                    </div>
                </div>
            )}

            <HelperFileSelectModal
                isOpen={activeModal === MODAL_TYPES.HELPER_FILE_SELECT}
                onClose={() => {
                    actions.closeModal();
                    actions.clearPendingHelper();
                }}
                onConfirm={executeHelperOnFiles}
                files={uploadQueue.filter(f => f.status === DOC_STATUS.READY)}
                helper={pendingHelper}
                currentDocumentId={selectedDocumentId}
                currentFilename={documentState?.filename}
            />
        </div>
    );
}

// ============================================
// SUB-COMPONENTS (Layout Components)
// ============================================

/**
 * Left Sidebar - File Queue
 */
function LeftSidebar({
    collapsed,
    onToggle,
    uploadQueue,
    ingestedFiles,
    selectedDocumentId,
    checkedDocumentIds,
    onSelect,
    onCheck,
    multiSelectMode,
    isPreviewMode,
    previewDocumentIds,
    onRemoveFromPreview,
    onRemoveFromContent,
    onRemoveIngestedFile,
    contentType,
    isDragging,
    isIngesting,
    onFilesSelected,
    onDragOver,
    onDragLeave,
    onDrop,
    onToggleMultiSelect,
    onOpenCacheManagement,
}) {
    return (
        <div
            className={`
                ${collapsed ? 'w-12' : 'w-56 lg:w-64'} 
                bg-tum-blue-light-4 flex flex-col border-r border-tum-grey-7 rounded-r-2xl
                transition-all duration-300 ease-in-out flex-shrink-0
            `}
        >
            {/* Header with toggle */}
            <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <h2 className="text-lg font-bold text-tum-blue">Document Ingestion</h2>
                )}
                <button
                    onClick={onToggle}
                    className="w-8 h-8 bg-tum-white/50 border border-tum-grey-7
                        flex items-center justify-center rounded-lg
                        hover:bg-tum-white transition-colors"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <span className="text-sm text-tum-black font-bold">
                        {collapsed ? '»' : '«'}
                    </span>
                </button>
            </div>

            {!collapsed && (
                <div className="px-4 pb-4 flex flex-col flex-1 overflow-hidden pt-4">
                    <UploadZone
                        onFilesSelected={onFilesSelected}
                        disabled={isIngesting || isPreviewMode}
                        isDragging={isDragging}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                    />

                    {!isPreviewMode && (
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                onClick={onToggleMultiSelect}
                                disabled={isPreviewMode}
                                className={`text-xs px-2 py-1 rounded transition-colors ${multiSelectMode
                                    ? 'bg-tum-blue text-white'
                                    : 'bg-tum-grey-9 text-tum-grey-3 hover:bg-tum-grey-8'
                                    } ${isPreviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={multiSelectMode ? 'Exit multi-select' : 'Enable multi-select'}
                            >
                                {multiSelectMode ? '✓ Multi-Select' : '☐ Multi-Select'}
                            </button>
                        </div>
                    )}

                    <div className="mt-3 flex-1 overflow-y-auto">
                        <FileQueue
                            files={uploadQueue}
                            ingestedFiles={ingestedFiles}
                            selectedDocumentId={selectedDocumentId}
                            checkedDocumentIds={checkedDocumentIds}
                            onSelect={onSelect}
                            onCheck={onCheck}
                            multiSelectMode={multiSelectMode}
                            isPreviewMode={isPreviewMode}
                            previewDocumentIds={previewDocumentIds}
                            onRemoveFromPreview={onRemoveFromPreview}
                            onRemoveFromContent={isPreviewMode ? onRemoveFromPreview : (
                                contentType === CONTENT_TYPE.EMBEDDING
                                    ? onRemoveIngestedFile
                                    : onRemoveFromContent
                            )}
                            onRemoveIngestedFile={onRemoveIngestedFile}
                            showIngestedSection={!isPreviewMode}
                        />
                    </div>

                    <div className="mt-3 pt-3 border-t border-tum-grey-7">
                        <button
                            onClick={onOpenCacheManagement}
                            disabled={isPreviewMode}
                            className={`w-full text-xs px-3 py-2 bg-tum-grey-9 text-tum-grey-3 
                                rounded-lg hover:bg-tum-grey-8 hover:text-tum-black transition-colors
                                flex items-center justify-center gap-2
                                ${isPreviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Manage Cache
                        </button>
                    </div>
                </div>
            )}

            {collapsed && (
                <div className="flex flex-col items-center pt-4">
                    <span className="text-2xl mb-2" title="Documents">📄</span>
                    <span className="text-xs text-tum-grey-3">
                        {uploadQueue.length > 0 && `${uploadQueue.length}`}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Right Sidebar - Helpers
 */
function RightSidebar({ collapsed, onToggle, onRunHelper, disabled, runningHelper }) {
    return (
        <div
            className={`
                ${collapsed ? 'w-12' : 'w-48 lg:w-56'} 
                bg-white border-l border-tum-grey-7 flex flex-col
                transition-all duration-300 ease-in-out flex-shrink-0
            `}
        >
            <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-tum-grey-7`}>
                <button
                    onClick={onToggle}
                    className="w-8 h-8 bg-tum-blue-light-5 border border-tum-grey-7
                        flex items-center justify-center
                        hover:bg-tum-blue-light-3 transition-colors"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <span className="text-sm text-tum-blue font-bold">
                        {collapsed ? '«' : '»'}
                    </span>
                </button>
                {!collapsed && (
                    <h3 className="text-sm font-semibold text-tum-blue">Helpers</h3>
                )}
            </div>

            {!collapsed && (
                <HelperPanel
                    onRunHelper={onRunHelper}
                    disabled={disabled}
                    runningHelper={runningHelper}
                />
            )}

            {collapsed && (
                <div className="flex flex-col items-center pt-4">
                    <span className="text-2xl" title="Helpers">🛠️</span>
                </div>
            )}
        </div>
    );
}

/**
 * Content Header with title and actions
 */
function ContentHeader({
    documentState,
    isEditingTitle,
    editingTitleValue,
    onTitleChange,
    onTitleClick,
    onTitleBlur,
    onTitleKeyDown,
    currentPage,
    totalPages,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onIngest,
    canIngest,
}) {
    return (
        <div className="bg-white border-b border-tum-grey-7 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                    {documentState ? (
                        isEditingTitle ? (
                            <input
                                type="text"
                                value={editingTitleValue}
                                onChange={(e) => onTitleChange(e.target.value)}
                                onBlur={onTitleBlur}
                                onKeyDown={onTitleKeyDown}
                                autoFocus
                                className="w-full text-xl font-bold text-tum-black bg-white border border-tum-blue 
                                    px-3 py-2 focus:outline-none focus:ring-1 focus:ring-tum-blue"
                            />
                        ) : (
                            <h1
                                className="text-xl font-bold text-tum-black cursor-text hover:bg-tum-blue-light-5 
                                    px-3 py-2 -mx-3 -my-2 transition-colors border border-transparent hover:border-tum-grey-7"
                                onClick={onTitleClick}
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

            <div className="flex items-center justify-between">
                {documentState && (
                    <p className="text-sm text-tum-grey-4">
                        Page {currentPage} of {totalPages}
                    </p>
                )}
                {!documentState && <div />}

                <SaveBar
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    onIngest={onIngest}
                    canIngest={canIngest}
                />
            </div>
        </div>
    );
}
