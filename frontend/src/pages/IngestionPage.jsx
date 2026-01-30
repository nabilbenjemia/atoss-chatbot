/**
 * IngestionPage
 * 
 * Admin page for document ingestion workflow using Context + Reducer pattern.
 * This component is purely for LAYOUT - all business logic is in Connected components.
 * 
 * Layout: Three-panel (File Queue | Content Viewer | Helper Panel)
 * 
 * Route: /admin/ingestion
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md for component breakdown
 * @see doc/ingestion/REDUCER.md for state management documentation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Context and hooks
import {
    IngestionProvider,
    useUI,
    useFileQueue,
    useDocument,
    usePreview,
    useIngestionActions,
    MODAL_TYPES,
    DOC_STATUS,
    CONTENT_TYPE,
} from '../context/ingestion';

// External hooks
import useBackendConfig from '../hooks/useBackendConfig';
import useCommandHistory, { Commands, serializeCommand } from '../hooks/useCommandHistory';

// Utility functions
import { mockCurrentUser, shouldUseMockAuth } from '../mocks/ingestionMocks';
import { getCurrentUser } from '../services/api';
import {
    getUploadedFiles,
    getIngestedFiles,
    getFileContent,
    getFileHistory,
    getIngestedFileEmbeddings,
    saveFileContent,
    saveFileHistory,
    updateUploadedFile,
    createIngestedFile,
    checkIngestionDuplicate,
} from '../utils/fileCacheManager';
import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { previewEmbeddings, startIngestion, generateImageDescriptions } from '../services/ingestionApi';

// Connected components (own their business logic)
import {
    ConnectedFileQueue,
    ConnectedUploadZone,
    ConnectedContentViewer,
    ConnectedHelperPanel,
} from '../components/ingestion';

// Pure UI components
import {
    SaveBar,
    EmbeddingPreviewViewer,
    CacheManagement,
    IngestionModal,
    RegexInputModal,
    HelperFileSelectModal,
} from '../components/ingestion';

/**
 * Main IngestionPage Component
 * Wrapped with IngestionProvider for state management
 */
export default function IngestionPage() {
    return (
        <IngestionProvider>
            <IngestionPageLayout />
        </IngestionProvider>
    );
}

/**
 * Layout Component - Orchestrates the three-panel layout
 * Business logic is delegated to Connected components
 */
function IngestionPageLayout() {
    const navigate = useNavigate();
    const { config: backendConfig, loading: configLoading } = useBackendConfig();

    // Local UI state for title editing
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitleValue, setEditingTitleValue] = useState('');
    const [showCacheManagement, setShowCacheManagement] = useState(false);

    // Ref to track which document the current command history belongs to
    // This prevents saving history to wrong file during file switches
    const commandHistoryDocIdRef = useRef(null);

    // UI state from context
    const {
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        isIngesting,
        ingestionProgress,
        activeModal,
        pendingHelper,
        multiSelectMode,
        checkedDocumentIds,
    } = useUI();

    const { uploadQueue, selectedDocumentId } = useFileQueue();
    const fileQueue = useFileQueue(); // Also get the model for method access
    const { currentPage, contentType, storedEmbeddings } = useDocument();
    const { isPreviewMode, embeddingPreview, isLoadingPreview, previewDocumentIds, previewConfig } = usePreview();
    const actions = useIngestionActions();

    // Memoized selector: only changes when the selected ingested file changes
    // This avoids re-running effects when unrelated files are added/removed
    const selectedIngestedFile = useMemo(
        () => selectedDocumentId ? fileQueue.getIngestedFileById(selectedDocumentId) : null,
        [fileQueue, selectedDocumentId]
    );

    // Shared command history for undo/redo (used by ContentViewer and HelperPanel)
    const {
        state: commandDocumentState,
        execute: executeCommand,
        undo,
        redo,
        reset: resetCommandDocument,
        restore: restoreCommandDocument,
        getFullState: getCommandFullState,
        canUndo,
        canRedo,
    } = useCommandHistory(null);

    // Auto-save document content and command history
    // Only save when the current command history belongs to the selected document
    // Use commandDocumentState directly (source of truth for editing)
    useEffect(() => {
        if (commandDocumentState && selectedDocumentId && commandHistoryDocIdRef.current === selectedDocumentId) {
            saveFileContent(selectedDocumentId, commandDocumentState);
            // Save serialized command history for undo/redo persistence
            const fullState = getCommandFullState();
            saveFileHistory(selectedDocumentId, fullState);
            updateUploadedFile(selectedDocumentId, { filename: commandDocumentState.filename });
        }
    }, [commandDocumentState, selectedDocumentId, getCommandFullState]);

    // ===== Initialization Effects =====

    // Auth check
    useEffect(() => {
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
    }, [navigate]);

    // Load cached files on mount
    useEffect(() => {
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

        // ...existing code...
    }, [actions, resetCommandDocument]);

    // Load document content when file is selected
    useEffect(() => {
        if (!selectedDocumentId) {
            // No file selected - reset document state and clear ref
            commandHistoryDocIdRef.current = null;
            resetCommandDocument(null);
            actions.resetDocument();
            return;
        }

        // Use the memoized selector - only re-runs when the specific ingested file changes
        if (selectedIngestedFile) {
            // Load embeddings for ingested file - no command history for these
            commandHistoryDocIdRef.current = null;
            const embeddings = getIngestedFileEmbeddings(selectedIngestedFile.ingestedId);
            if (embeddings) {
                // This sets contentType to EMBEDDING and clears documentState
                actions.setStoredEmbeddings(embeddings, selectedDocumentId);
                resetCommandDocument(null); // No editing for ingested files
            }
            return;
        }

        // Load document content from cache (uploaded file)
        const content = getFileContent(selectedDocumentId);
        if (content) {
            // Try to restore command history (undo/redo) for this file
            const savedHistory = getFileHistory(selectedDocumentId);
            if (savedHistory && (savedHistory.past?.length > 0 || savedHistory.future?.length > 0)) {
                // Restore full state with history
                restoreCommandDocument({
                    past: savedHistory.past || [],
                    present: content,
                    future: savedHistory.future || [],
                });
            } else {
                // No history - start fresh
                resetCommandDocument(content);
            }
            // Mark this document as the one owning the current command history
            // This prevents auto-save from saving to wrong file during transitions
            commandHistoryDocIdRef.current = selectedDocumentId;
            actions.loadDocument(content, selectedDocumentId);
        }
    }, [selectedDocumentId, selectedIngestedFile, actions, resetCommandDocument, restoreCommandDocument]);

    // ===== Modal Handlers =====

    const handleCloseModal = useCallback(() => {
        actions.closeModal();
    }, [actions]);

    const handleShowPreview = useCallback(async (targetDb, strategy) => {
        // Determine which documents to preview
        // If multi-select mode with checked files, use those; otherwise use current file
        const documentIdsToPreview = multiSelectMode && checkedDocumentIds.size > 0
            ? Array.from(checkedDocumentIds)
            : [selectedDocumentId];

        if (documentIdsToPreview.length === 0 || !documentIdsToPreview[0]) {
            toast.error('No documents selected');
            return;
        }

        // Get the first document to generate initial preview
        const firstDocId = documentIdsToPreview[0];
        const firstDocContent = getFileContent(firstDocId);

        if (!firstDocContent) {
            toast.error('Could not load document content');
            return;
        }

        // Start preview mode with all selected documents
        actions.startPreview(targetDb, strategy, documentIdsToPreview, rightSidebarCollapsed);

        try {
            // Call API to generate preview embeddings for first document
            const result = await previewEmbeddings(strategy, firstDocContent);

            if (result.success) {
                actions.setPreviewGenerated(result.preview);
                // Also select the first document
                actions.selectFile(firstDocId);
            } else {
                throw new Error(result.error || 'Failed to generate preview');
            }
        } catch (error) {
            console.error('Preview generation failed:', error);
            toast.error(`Preview failed: ${error.message}`);
            actions.failPreview(rightSidebarCollapsed);
        }
    }, [multiSelectMode, checkedDocumentIds, selectedDocumentId, rightSidebarCollapsed, actions]);

    const handleRegexConfirm = useCallback((pattern) => {
        if (!commandDocumentState) return;

        const regex = new RegExp(pattern, 'i');
        const matchingIds = [];

        for (const page of commandDocumentState.pages) {
            for (const item of page.items) {
                if (item.type === 'text' && !item.deleted && regex.test(item.content)) {
                    matchingIds.push(item.id);
                }
            }
        }

        if (matchingIds.length > 0) {
            executeCommand(Commands.batchDelete(matchingIds));
            toast.success(`${matchingIds.length} item(s) matched and deleted`);
        } else {
            toast.info('No items matched the pattern');
        }
        actions.closeModal();
    }, [commandDocumentState, executeCommand, actions]);

    const handleHelperFileSelectConfirm = useCallback(async (selectedDocumentIds) => {
        actions.closeModal();

        if (!pendingHelper || !selectedDocumentIds || selectedDocumentIds.length === 0) {
            actions.clearPendingHelper();
            return;
        }

        actions.startHelper(pendingHelper.id);

        try {
            let totalAffected = 0;
            let filesProcessed = 0;

            // Process each selected file
            for (const docId of selectedDocumentIds) {
                const isCurrentDocument = docId === selectedDocumentId;

                // Get document content
                // For current document, use commandDocumentState (source of truth)
                // For other documents, load from cache
                const docContent = isCurrentDocument && commandDocumentState
                    ? commandDocumentState
                    : getFileContent(docId);

                if (!docContent || !docContent.pages) {
                    console.warn(`[Helper] No content found for document: ${docId}`);
                    continue;
                }

                let affectedIds = [];

                // Collect items to modify based on helper type
                switch (pendingHelper.id) {
                    case 'remove_logos': {
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if ((item.type === 'image' || item.type === 'picture') && item.classification === 'logo' && !item.deleted) {
                                    affectedIds.push(item.id);
                                }
                            }
                        }
                        break;
                    }

                    case 'remove_empty': {
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if (item.type === 'text' && !item.deleted) {
                                    const trimmed = item.content.trim();
                                    if (!trimmed || trimmed.length <= 1) {
                                        affectedIds.push(item.id);
                                    }
                                }
                            }
                        }
                        break;
                    }

                    case 'ai_image_descriptions': {
                        // Collect all images from this document
                        const images = [];
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if ((item.type === 'image' || item.type === 'picture') && !item.deleted) {
                                    images.push({
                                        id: item.id,
                                        imageUrl: item.imageUrl,
                                        classification: item.classification || 'unclassified',
                                        pageNumber: page.pageNumber,
                                    });
                                }
                            }
                        }

                        if (images.length > 0) {
                            // Call backend to generate descriptions
                            const result = await generateImageDescriptions(docId, images);

                            if (result.success && result.descriptions) {
                                // Create insertions: new text items after each image
                                const insertions = result.descriptions
                                    .filter(d => d.description)
                                    .map(d => ({
                                        afterItemId: d.imageId,
                                        newItem: {
                                            id: `desc_${d.imageId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                            type: 'text',
                                            content: `**Image Description:** ${d.description}`,
                                            deleted: false,
                                        },
                                    }));

                                if (insertions.length > 0) {
                                    const command = Commands.batchInsertAfter(insertions);

                                    if (isCurrentDocument) {
                                        executeCommand(command);
                                    } else {
                                        // Execute on non-current document
                                        const newContent = command.execute(docContent);
                                        const existingHistory = getFileHistory(docId) || { past: [], future: [] };
                                        const serializedCmd = serializeCommand(command);
                                        const newHistory = {
                                            past: [...existingHistory.past, serializedCmd],
                                            future: [],
                                        };
                                        saveFileContent(docId, newContent);
                                        saveFileHistory(docId, newHistory);
                                    }
                                    totalAffected += insertions.length;
                                }
                            }
                        }
                        filesProcessed++;
                        continue; // Skip the default batchDelete logic below
                    }

                    default:
                        break;
                }

                if (affectedIds.length > 0) {
                    // Create the command
                    const command = Commands.batchDelete(affectedIds);

                    if (isCurrentDocument) {
                        // For current document, use the hook (updates UI immediately)
                        executeCommand(command);
                    } else {
                        // For other documents, execute command and save with history
                        // 1. Execute command to get new state
                        const newContent = command.execute(docContent);

                        // 2. Load existing history (or create empty)
                        const existingHistory = getFileHistory(docId) || { past: [], future: [] };

                        // 3. Add command to past (serialized), clear future
                        const serializedCmd = serializeCommand(command);
                        const newHistory = {
                            past: [...existingHistory.past, serializedCmd],
                            future: [], // Clear redo stack when new command is executed
                        };

                        // 4. Save both content and history
                        saveFileContent(docId, newContent);
                        saveFileHistory(docId, newHistory);
                    }
                    totalAffected += affectedIds.length;
                }
                filesProcessed++;
            }

            // Show result
            let helperLabel;
            let actionVerb;
            if (pendingHelper.id === 'remove_logos') {
                helperLabel = 'logo(s)';
                actionVerb = 'removed from';
            } else if (pendingHelper.id === 'ai_image_descriptions') {
                helperLabel = 'image description(s)';
                actionVerb = 'generated for';
            } else {
                helperLabel = 'item(s)';
                actionVerb = 'removed from';
            }

            if (totalAffected > 0) {
                toast.success(`${totalAffected} ${helperLabel} ${actionVerb} ${filesProcessed} file(s)`);
            } else {
                toast.info(`No ${helperLabel} found in selected files`);
            }

            actions.completeHelper();
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error('Helper failed: ' + error.message);
            actions.failHelper();
        }

        actions.clearPendingHelper();
    }, [actions, pendingHelper, selectedDocumentId, commandDocumentState, executeCommand]);

    // Confirm and ingest (single file)
    const handleConfirmIngestion = useCallback(async () => {
        if (!commandDocumentState || !previewConfig.targetDb) {
            toast.error('Missing document or target database');
            return;
        }

        // Check for duplicate ingestion (same content + strategy + targetDb)
        const { isDuplicate, existingEntry, ingestionId } = checkIngestionDuplicate(
            commandDocumentState,
            previewConfig.strategy,
            previewConfig.targetDb
        );

        if (isDuplicate) {
            toast.warning(
                `This exact content was already ingested to ${previewConfig.targetDb} with ${previewConfig.strategy} strategy on ${new Date(existingEntry.timestamp).toLocaleString()}`,
                { autoClose: 5000 }
            );
            return;
        }

        // Start ingestion (sets isIngesting: true)
        actions.startIngestion();

        try {
            const result = await startIngestion(
                previewConfig.targetDb,
                commandDocumentState,
                previewConfig.strategy
            );

            if (result.success) {
                // Create ingested entry in cache with ingestionId for future duplicate detection
                const ingestedEntry = createIngestedFile(
                    selectedDocumentId,
                    previewConfig.strategy,
                    embeddingPreview,
                    { filename: commandDocumentState.filename, documentId: selectedDocumentId },
                    previewConfig.targetDb,
                    ingestionId
                );

                // Update state
                actions.completeIngestion(
                    selectedDocumentId,
                    ingestedEntry,
                    embeddingPreview,
                    rightSidebarCollapsed
                );

                toast.success(`Document ingested successfully to ${previewConfig.targetDb}`);
            } else {
                throw new Error(result.error || 'Ingestion failed');
            }
        } catch (error) {
            console.error('Ingestion failed:', error);
            toast.error(`Ingestion failed: ${error.message}`);
            actions.failIngestion();
        }
    }, [commandDocumentState, selectedDocumentId, previewConfig, embeddingPreview, rightSidebarCollapsed, actions]);

    // Confirm and ingest all files in preview
    const handleConfirmIngestionAll = useCallback(async () => {
        if (!previewConfig.targetDb) {
            toast.error('Missing target database');
            return;
        }

        const documentIds = Array.from(previewDocumentIds);
        if (documentIds.length === 0) {
            toast.error('No files to ingest');
            return;
        }

        // Start ingestion
        actions.startIngestion();

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;
        const ingestedEntries = [];

        for (let i = 0; i < documentIds.length; i++) {
            const docId = documentIds[i];
            const content = getFileContent(docId);

            if (!content) {
                console.error(`No content found for document ${docId}`);
                failCount++;
                continue;
            }

            // Check for duplicate ingestion
            const { isDuplicate, ingestionId } = checkIngestionDuplicate(
                content,
                previewConfig.strategy,
                previewConfig.targetDb
            );

            if (isDuplicate) {
                console.info(`Skipping duplicate: ${docId} already ingested with same content/strategy/db`);
                skipCount++;
                continue;
            }

            // Update progress
            actions.updateIngestionProgress(Math.round(((i) / documentIds.length) * 100));

            try {
                const result = await startIngestion(
                    previewConfig.targetDb,
                    content,
                    previewConfig.strategy
                );

                if (result.success) {
                    // Generate preview for this file to store with ingested entry
                    let filePreview = null;
                    try {
                        const previewResult = await previewEmbeddings(previewConfig.strategy, content);
                        if (previewResult.success) {
                            filePreview = previewResult.preview;
                        }
                    } catch (previewError) {
                        console.warn(`Could not generate preview for ${docId}:`, previewError);
                    }

                    // Create ingested entry in cache with ingestionId
                    const ingestedEntry = createIngestedFile(
                        docId,
                        previewConfig.strategy,
                        filePreview,
                        { filename: content.filename, documentId: docId },
                        previewConfig.targetDb,
                        ingestionId
                    );

                    // Collect all ingested entries
                    ingestedEntries.push(ingestedEntry);
                    successCount++;
                } else {
                    console.error(`Ingestion failed for ${docId}:`, result.error);
                    failCount++;
                }
            } catch (error) {
                console.error(`Ingestion error for ${docId}:`, error);
                failCount++;
            }
        }

        // Complete batch ingestion
        if (successCount > 0) {
            actions.completeBatchIngestion(ingestedEntries, rightSidebarCollapsed);

            if (failCount > 0 || skipCount > 0) {
                const parts = [];
                parts.push(`${successCount} ingested`);
                if (skipCount > 0) parts.push(`${skipCount} skipped (duplicates)`);
                if (failCount > 0) parts.push(`${failCount} failed`);
                toast.warning(parts.join(', '));
            } else {
                toast.success(`Successfully ingested ${successCount} file(s) to ${previewConfig.targetDb}`);
            }
        } else if (skipCount > 0 && failCount === 0) {
            actions.failIngestion();
            toast.info(`All ${skipCount} file(s) were already ingested with the same content/strategy/db`);
        } else {
            actions.failIngestion();
            toast.error('All ingestions failed');
        }
    }, [previewDocumentIds, previewConfig, rightSidebarCollapsed, actions]);

    // Cache cleared handler
    const handleCacheCleared = useCallback(() => {
        // Reset UI state when cache is cleared
        actions.clearAllFiles();
        resetCommandDocument(null);
        toast.success('Cache cleared successfully');
    }, [actions, resetCommandDocument]);

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    undo();
                }
            }
            // Ctrl/Cmd + Shift + Z = Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (canRedo) {
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // ===== Render =====

    const totalPages = commandDocumentState?.pages?.length || 0;

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
                        onClick={() => actions.toggleLeftSidebar()}
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
                        <ConnectedUploadZone
                            resetCommandDocument={resetCommandDocument}
                        />

                        {/* Multi-select toggle (disabled in preview mode) */}
                        {!isPreviewMode && (
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    onClick={() => actions.toggleMultiSelect()}
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

                        {/* File Queue */}
                        <div className="mt-3 flex-1 overflow-y-auto">
                            <ConnectedFileQueue />
                        </div>

                        {/* Cache Management Button */}
                        <div className="mt-3 pt-3 border-t border-tum-grey-7">
                            <button
                                onClick={() => setShowCacheManagement(true)}
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
                {/* Header / Save Bar - hidden in preview mode, different for embedding mode */}
                {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                    <div className="bg-white border-b border-tum-grey-7 px-6 py-4">
                        {/* Title row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                                {commandDocumentState ? (
                                    isEditingTitle ? (
                                        <input
                                            type="text"
                                            value={editingTitleValue}
                                            onChange={(e) => setEditingTitleValue(e.target.value)}
                                            onBlur={() => {
                                                const trimmed = editingTitleValue.trim();
                                                if (trimmed && trimmed !== commandDocumentState.filename) {
                                                    executeCommand(Commands.renameDocument(trimmed, commandDocumentState.filename));
                                                    actions.updateFilename(selectedDocumentId, trimmed);
                                                }
                                                setIsEditingTitle(false);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.target.blur();
                                                } else if (e.key === 'Escape') {
                                                    setEditingTitleValue(commandDocumentState.filename);
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
                                                setEditingTitleValue(commandDocumentState.filename);
                                                setIsEditingTitle(true);
                                            }}
                                            title="Click to edit filename"
                                        >
                                            {commandDocumentState.filename}
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
                            {commandDocumentState && (
                                <p className="text-sm text-tum-grey-4">
                                    Page {currentPage} of {totalPages}
                                </p>
                            )}
                            {!commandDocumentState && <div />}

                            <SaveBar
                                canUndo={canUndo}
                                canRedo={canRedo}
                                onUndo={undo}
                                onRedo={redo}
                                onIngest={() => actions.openModal(MODAL_TYPES.INGEST)}
                                canIngest={!!commandDocumentState && !isIngesting && !isPreviewMode}
                            />
                        </div>
                    </div>
                )}

                {/* Content Viewer or Preview Viewer */}
                {configLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-tum-grey-4">Loading configuration...</div>
                    </div>
                ) : isPreviewMode ? (
                    <EmbeddingPreviewViewer
                        preview={embeddingPreview}
                        isLoading={isLoadingPreview}
                        onCancel={() => actions.exitPreviewMode(rightSidebarCollapsed)}
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
                    <ConnectedContentViewer
                        commandState={commandDocumentState}
                        executeCommand={executeCommand}
                    />
                )}
            </main>

            {/* Right Panel - Helpers (hidden in preview mode and embedding mode) */}
            {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                <div
                    className={`
                        ${rightSidebarCollapsed ? 'w-12' : 'w-56 lg:w-64'} 
                        bg-white border-l border-tum-grey-7 flex flex-col
                        transition-all duration-300 ease-in-out flex-shrink-0
                    `}
                >
                    {/* Header with toggle */}
                    <div className={`p-4 flex items-center ${rightSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-tum-grey-7`}>
                        <button
                            onClick={() => actions.toggleRightSidebar()}
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

                    {/* Content: Helpers */}
                    {!rightSidebarCollapsed && (
                        <ConnectedHelperPanel
                            commandState={commandDocumentState}
                            executeCommand={executeCommand}
                        />
                    )}

                    {/* Collapsed state icon */}
                    {rightSidebarCollapsed && (
                        <div className="flex flex-col items-center pt-4">
                            <span className="text-2xl" title="Helpers">🛠️</span>
                        </div>
                    )}
                </div>
            )}

            {/* Ingestion Modal */}
            <IngestionModal
                isOpen={activeModal === MODAL_TYPES.INGEST}
                onClose={handleCloseModal}
                onShowPreview={handleShowPreview}
                backendConfig={backendConfig}
                isIngesting={isIngesting}
                progress={ingestionProgress}
            />

            {/* Regex Input Modal */}
            <RegexInputModal
                isOpen={activeModal === MODAL_TYPES.REGEX}
                onClose={handleCloseModal}
                onConfirm={handleRegexConfirm}
            />

            {/* Cache Management Modal */}
            {showCacheManagement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-tum-black/40 backdrop-blur-sm"
                        onClick={() => setShowCacheManagement(false)}
                    />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                        <CacheManagement
                            onClose={() => setShowCacheManagement(false)}
                            onCacheCleared={handleCacheCleared}
                        />
                    </div>
                </div>
            )}

            {/* Helper File Selection Modal */}
            <HelperFileSelectModal
                isOpen={activeModal === MODAL_TYPES.HELPER_FILE_SELECT}
                onClose={handleCloseModal}
                onConfirm={handleHelperFileSelectConfirm}
                files={uploadQueue.filter(f => f.status === DOC_STATUS.READY)}
                helper={pendingHelper}
                currentDocumentId={selectedDocumentId}
                currentFilename={commandDocumentState?.filename}
            />
        </div>
    );
}
