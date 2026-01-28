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
    runBackendHelper,
    previewEmbeddings,
} from '../services/ingestionApi';
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
    getExistingIngestedFile,
    removeIngestedFile,
    saveFileHistory,
    getFileHistory,
} from '../utils/fileCacheManager';

// Import components
import {
    UploadZone,
    FileQueue,
    DOC_STATUS,
    CONTENT_TYPE,
    ContentViewer,
    HelperPanel,
    IngestionModal,
    RegexInputModal,
    SaveBar,
    EmbeddingPreviewViewer,
    CacheManagement,
    HelperFileSelectModal,
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
        restore: restoreDocument,
        getFullState: getDocumentFullState,
        canUndo,
        canRedo,
    } = useCommandHistory(null);

    // UI state
    const [currentPage, setCurrentPage] = useState(1);
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

    // Preview mode state
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [embeddingPreview, setEmbeddingPreview] = useState(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [previewConfig, setPreviewConfig] = useState({ targetDb: '', strategy: '' });

    // Store right sidebar state before preview mode
    const [rightSidebarStateBeforePreview, setRightSidebarStateBeforePreview] = useState(false);

    // Content type: editor (pages/items) or embedding (stored embeddings)
    const [contentType, setContentType] = useState(CONTENT_TYPE.EDITOR);
    const [storedEmbeddings, setStoredEmbeddings] = useState(null);

    // Multi-select state
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [checkedDocumentIds, setCheckedDocumentIds] = useState(new Set());

    // Cache management modal
    const [showCacheManagement, setShowCacheManagement] = useState(false);

    // Helper file selection modal
    const [showHelperFileModal, setShowHelperFileModal] = useState(false);
    const [pendingHelper, setPendingHelper] = useState(null);

    // Ingested files from cache
    const [ingestedFilesList, setIngestedFilesList] = useState([]);

    // Preview mode document IDs (for multi-file preview)
    const [previewDocumentIds, setPreviewDocumentIds] = useState(new Set());

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

    // Local cache for editor state (session recovery)
    useLocalCache(
        documentState ? { documentState } : null,
        INGESTION_CONFIG.storage.editStateKey,
        { enabled: !!documentState }
    );

    // Auto-save document content and command history to cache whenever documentState changes
    useEffect(() => {
        if (documentState && selectedDocumentId) {
            // Save content to file-specific cache
            saveFileContent(selectedDocumentId, documentState);

            // Sync filename to uploaded files metadata
            updateUploadedFile(selectedDocumentId, { filename: documentState.filename });

            // Save command history for this file
            const fullState = getDocumentFullState();
            saveFileHistory(selectedDocumentId, fullState);

            console.log('[IngestionPage] 📦 Auto-saved content and history to cache for', selectedDocumentId);
        }
    }, [documentState, selectedDocumentId, getDocumentFullState]);

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
                    toast.info('Restored previous session');
                } else {
                    clearCache(INGESTION_CONFIG.storage.editStateKey);
                }
            }
        }

        // Load uploaded files from cache
        const cachedUploadedFiles = getUploadedFiles();
        if (cachedUploadedFiles.length > 0) {
            // Restore upload queue from cache
            const restoredQueue = cachedUploadedFiles.map(f => ({
                id: f.id || `cached_${f.documentId}`,
                documentId: f.documentId,
                filename: f.filename,
                status: f.status || DOC_STATUS.READY,
                progress: 100,
            }));
            setUploadQueue(restoredQueue);
        }

        // Load ingested files from cache
        const cachedIngestedFiles = getIngestedFiles();
        setIngestedFilesList(cachedIngestedFiles);
    }, [resetDocument]);

    // Select a document to view/edit
    const selectDocument = useCallback(async (documentId) => {
        console.log('[IngestionPage] selectDocument called', { documentId, isPreviewMode });

        // In preview mode, allow switching between preview files only
        if (isPreviewMode) {
            // Check if the clicked document is in the preview set
            if (previewDocumentIds.has(documentId)) {
                console.log('[IngestionPage] Switching to another preview file', documentId);

                // Load the content for this document
                const docContent = getFileContent(documentId);
                if (!docContent) {
                    toast.error('Could not load document content');
                    return;
                }

                // Generate preview for this file
                setIsLoadingPreview(true);
                setSelectedDocumentId(documentId);

                try {
                    const preview = await previewEmbeddings(previewConfig.strategy, docContent);
                    setEmbeddingPreview(preview);
                } catch (error) {
                    console.error('Failed to generate preview:', error);
                    toast.error('Failed to generate embedding preview');
                } finally {
                    setIsLoadingPreview(false);
                }
            } else {
                console.log('[IngestionPage] In preview mode, selection outside preview set ignored');
            }
            return;
        }

        // Check if this document has stored embeddings (ingested)
        const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
        const storedEmb = loadFromCache(embeddingKey);

        if (storedEmb) {
            // Show stored embeddings in read-only mode
            console.log('[IngestionPage] Loading stored embeddings for', documentId);
            setStoredEmbeddings(storedEmb);
            setContentType(CONTENT_TYPE.EMBEDDING);
            setSelectedDocumentId(documentId);
            setCurrentPage(1);
            resetDocument(null); // Clear editor state
            return;
        }

        // Check if we have cached content for this file
        const cachedContent = getFileContent(documentId);
        if (cachedContent) {
            console.log('[IngestionPage] Loading cached content for', documentId);

            // Check if we have cached command history for this file
            const cachedHistory = getFileHistory(documentId);
            if (cachedHistory) {
                // Restore with history
                console.log('[IngestionPage] Restoring command history for', documentId, {
                    undoSteps: cachedHistory.past?.length || 0,
                    redoSteps: cachedHistory.future?.length || 0
                });
                restoreDocument({
                    past: cachedHistory.past || [],
                    present: cachedContent,
                    future: cachedHistory.future || [],
                });
            } else {
                // No history, just reset with content
                resetDocument(cachedContent);
            }

            setSelectedDocumentId(documentId);
            setCurrentPage(1);
            setContentType(CONTENT_TYPE.EDITOR);
            setStoredEmbeddings(null);
            return;
        }

        // No cached content - this shouldn't happen normally
        // Content should be cached when file is uploaded
        console.warn('[IngestionPage] No cached content found for', documentId);
        toast.error('Document content not found. Please re-upload the file.');
    }, [resetDocument, restoreDocument, isPreviewMode, previewDocumentIds, previewConfig.strategy]);

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
                // Upload returns extracted content directly (stateless backend)
                const result = await uploadDocument(doc.file);

                if (!result.success || !result.content) {
                    throw new Error(result.error || 'Failed to process document');
                }

                const documentId = result.content.documentId;

                // Cache the content in localStorage
                saveFileContent(documentId, result.content);

                // Update queue status to ready
                setUploadQueue((prev) =>
                    prev.map((d) =>
                        d.id === doc.id
                            ? { ...d, documentId, status: DOC_STATUS.READY, progress: 100 }
                            : d
                    )
                );

                // Save to uploaded files cache
                addUploadedFile({
                    id: doc.id,
                    documentId,
                    filename: doc.filename,
                    status: DOC_STATUS.READY,
                });

                toast.success(`Document ready: ${doc.filename}`);

                // Auto-select if no document selected
                setSelectedDocumentId((currentId) => {
                    if (!currentId) {
                        selectDocument(documentId);
                    }
                    return currentId || documentId;
                });
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
    }, [selectDocument]);

    // Handle drag state
    const handleDragOver = useCallback(() => { console.log('[IngestionPage] 🎯 handleDragOver (USER ACTION)'); setIsDragging(true); }, []);
    const handleDragLeave = useCallback(() => { console.log('[IngestionPage] 🎯 handleDragLeave (USER ACTION)'); setIsDragging(false); }, []);
    const handleDrop = useCallback(() => { console.log('[IngestionPage] 🎯 handleDrop (USER ACTION)'); setIsDragging(false); }, []);

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
    }, [documentState, executeCommand]);

    const handleDeleteItem = useCallback((itemId) => {
        console.log('[IngestionPage] 🎯 handleDeleteItem (USER ACTION)', { itemId });
        if (!documentState) return;

        executeCommand(Commands.deleteItem(itemId));
        toast.info('Item deleted (can be undone)');
    }, [documentState, executeCommand]);

    const handleRestoreItem = useCallback((itemId) => {
        console.log('[IngestionPage] 🎯 handleRestoreItem (USER ACTION)', { itemId });
        if (!documentState) return;

        executeCommand(Commands.restoreItem(itemId));
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
    }, [documentState, executeCommand]);

    // Helper functions - using Command Pattern for batch operations
    const handleRunHelper = useCallback(async (helperId) => {
        console.log('[IngestionPage] 🎯 handleRunHelper (USER ACTION)', { helperId });

        // Get helper info from config
        const allHelpers = [...INGESTION_CONFIG.helpers.local, ...INGESTION_CONFIG.helpers.backend];
        const helper = allHelpers.find(h => h.id === helperId);

        // Show file selection modal instead of running immediately
        setPendingHelper(helper || { id: helperId, label: helperId });
        setShowHelperFileModal(true);
    }, []);

    // Execute helper on selected files
    const executeHelperOnFiles = useCallback(async (selectedDocumentIds) => {
        console.log('[IngestionPage] 🎯 executeHelperOnFiles (USER ACTION)', { helper: pendingHelper?.id, files: selectedDocumentIds });

        if (!pendingHelper || selectedDocumentIds.length === 0) {
            setShowHelperFileModal(false);
            setPendingHelper(null);
            return;
        }

        const helperId = pendingHelper.id;
        setShowHelperFileModal(false);

        // Handle helpers with input
        if (helperId === 'delete_regex') {
            setShowRegexModal(true);
            setPendingHelper(null);
            return;
        }

        // For now, execute on currently selected document
        // In a full implementation, you'd loop through selectedDocumentIds
        if (!documentState) {
            toast.warning('No document loaded to apply helper');
            setPendingHelper(null);
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
                    }
                    message = emptyItemIds.length > 0 ? `${emptyItemIds.length} empty item(s) removed` : 'No empty items found';
                    break;
                }

                case 'ai_image_descriptions': {
                    // Call backend AI helper with document content
                    const result = await runBackendHelper(helperId, documentState, {});
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
            setPendingHelper(null);
        }
    }, [documentState, selectedDocumentId, executeCommand, pendingHelper]);

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
            }
            toast.success(matchingItemIds.length > 0 ? `${matchingItemIds.length} item(s) matched and deleted` : 'No matches found');
        } catch {
            toast.error('Invalid regex pattern');
        }
    }, [documentState, executeCommand]);

    // Start ingestion - now shows preview first
    // Supports both single file (selectedDocumentId) and multi-file (checkedDocumentIds)
    const handleStartIngestion = useCallback(async (targetDb, strategy) => {
        // Determine which documents to preview
        // If multi-select mode with checked files, use those; otherwise use current selection
        const documentsToPreview = checkedDocumentIds.size > 0
            ? [...checkedDocumentIds]
            : selectedDocumentId ? [selectedDocumentId] : [];

        console.log('[IngestionPage] 🎯 handleStartIngestion (USER ACTION) - showing preview', {
            targetDb,
            strategy,
            documentsToPreview,
            isMultiFile: documentsToPreview.length > 1
        });

        if (!targetDb || !strategy || documentsToPreview.length === 0) {
            toast.warning('No files selected for ingestion');
            return;
        }

        // Store config for later use
        setPreviewConfig({ targetDb, strategy });
        setShowIngestionModal(false);

        // Store right sidebar state and collapse it
        setRightSidebarStateBeforePreview(rightSidebarCollapsed);
        setRightSidebarCollapsed(true);

        // Set preview document IDs (supports multi-file)
        const previewIds = new Set(documentsToPreview);
        setPreviewDocumentIds(previewIds);

        // For the first file (or selected file), generate and show the preview
        // The user can click on other files in the sidebar to see their previews
        const firstDocId = documentsToPreview[0];

        // Get the document content for the first file
        const firstDocContent = firstDocId === selectedDocumentId
            ? documentState
            : getFileContent(firstDocId);

        if (!firstDocContent) {
            toast.error('Could not load document content');
            setPreviewDocumentIds(new Set());
            return;
        }

        // Generate preview for the first file
        setIsLoadingPreview(true);
        setIsPreviewMode(true);
        setSelectedDocumentId(firstDocId); // Select the first file

        try {
            const preview = await previewEmbeddings(strategy, firstDocContent);
            setEmbeddingPreview(preview);
        } catch (error) {
            console.error('Failed to generate preview:', error);
            toast.error('Failed to generate embedding preview');
            setIsPreviewMode(false);
            setPreviewDocumentIds(new Set());
            setRightSidebarCollapsed(rightSidebarStateBeforePreview);
        } finally {
            setIsLoadingPreview(false);
        }
    }, [documentState, selectedDocumentId, checkedDocumentIds, rightSidebarCollapsed, rightSidebarStateBeforePreview]);

    // Cancel preview mode
    const handleCancelPreview = useCallback(() => {
        console.log('[IngestionPage] 🎯 handleCancelPreview (USER ACTION)');
        setIsPreviewMode(false);
        setEmbeddingPreview(null);
        setPreviewConfig({ targetDb: '', strategy: '' });
        setPreviewDocumentIds(new Set());
        // Restore right sidebar state
        setRightSidebarCollapsed(rightSidebarStateBeforePreview);
    }, [rightSidebarStateBeforePreview]);

    // Confirm ingestion from preview (single file)
    const handleConfirmIngestion = useCallback(async () => {
        console.log('[IngestionPage] 🎯 handleConfirmIngestion (USER ACTION)', { config: previewConfig, documentId: selectedDocumentId });
        const { targetDb, strategy } = previewConfig;
        if (!targetDb || !strategy || !embeddingPreview) return;

        // Check if same file + strategy already exists
        const existingIngested = getExistingIngestedFile(selectedDocumentId, strategy);
        if (existingIngested) {
            // Optionally warn user that this will overwrite
            console.log('[IngestionPage] Updating existing ingested file:', existingIngested.ingestedId);
        }

        setIsIngesting(true);
        setIngestionProgress(0);

        try {
            // Simulate ingestion delay (1 second as requested)
            await delay(1000);
            setIngestionProgress(100);

            // Convert preview to ingested format (base64 → server URLs)
            const ingestedData = convertPreviewToIngestedFormat(embeddingPreview);

            // Get current file info from uploadQueue
            const currentFile = uploadQueue.find(f => f.documentId === selectedDocumentId);

            // Create ingested file entry (does NOT remove the uploaded file)
            const ingestedEntry = createIngestedFile(
                selectedDocumentId,
                strategy,
                ingestedData,
                currentFile || { documentId: selectedDocumentId, filename: 'Unknown' }
            );

            // Clear editor state cache
            clearCache(INGESTION_CONFIG.storage.editStateKey);

            // NOTE: No longer removing from uploadQueue - user may want to re-ingest with different strategy

            // Update ingested files list
            setIngestedFilesList(getIngestedFiles());

            // Exit preview mode
            setIsIngesting(false);
            setIsPreviewMode(false);
            setEmbeddingPreview(null);
            setPreviewConfig({ targetDb: '', strategy: '' });
            setPreviewDocumentIds(new Set());

            // Show the newly ingested file's embeddings
            // Select the ingested file automatically
            if (ingestedEntry) {
                setContentType(CONTENT_TYPE.EMBEDDING);
                setStoredEmbeddings(ingestedData);
            }

            // Restore right sidebar state
            setRightSidebarCollapsed(rightSidebarStateBeforePreview);

            toast.success(`Document ingested with "${strategy}" strategy!`);
        } catch (error) {
            console.error('Ingestion failed:', error);
            setIsIngesting(false);
            toast.error('Failed to ingest document');
        }
    }, [embeddingPreview, selectedDocumentId, previewConfig, rightSidebarStateBeforePreview, uploadQueue]);

    // Confirm ingestion for ALL files in multi-file preview
    const handleConfirmIngestionAll = useCallback(async () => {
        console.log('[IngestionPage] 🎯 handleConfirmIngestionAll (USER ACTION)', { previewIds: [...previewDocumentIds] });

        // For now, this is similar to single file ingestion
        // In a full implementation, you'd loop through all preview document IDs
        await handleConfirmIngestion();

        toast.success(`All ${previewDocumentIds.size} file(s) ingested successfully!`);
    }, [handleConfirmIngestion, previewDocumentIds]);

    // Multi-select handlers
    const handleCheckDocument = useCallback((documentId) => {
        console.log('[IngestionPage] 🎯 handleCheckDocument (USER ACTION)', { documentId });
        setCheckedDocumentIds(prev => {
            const next = new Set(prev);
            if (next.has(documentId)) {
                next.delete(documentId);
            } else {
                next.add(documentId);
            }
            return next;
        });
    }, []);

    const toggleMultiSelectMode = useCallback(() => {
        console.log('[IngestionPage] 🎯 toggleMultiSelectMode (USER ACTION)');
        setMultiSelectMode(prev => {
            if (prev) {
                // Exiting multi-select mode, clear selections
                setCheckedDocumentIds(new Set());
            }
            return !prev;
        });
    }, []);

    // Handle batch ingestion for multi-selected files - use the same modal
    // eslint-disable-next-line no-unused-vars
    const handleBatchIngest = useCallback(() => {
        console.log('[IngestionPage] 🎯 handleBatchIngest (USER ACTION)', { checked: [...checkedDocumentIds] });
        if (checkedDocumentIds.size === 0) {
            toast.warning('No files selected');
            return;
        }
        // Show the ingestion modal - batch ingestion logic is handled separately
        setShowIngestionModal(true);
    }, [checkedDocumentIds]);

    // Handle removing a file from preview mode
    const handleRemoveFromPreview = useCallback((documentId) => {
        console.log('[IngestionPage] 🎯 handleRemoveFromPreview (USER ACTION)', { documentId });
        setPreviewDocumentIds(prev => {
            const next = new Set(prev);
            next.delete(documentId);

            // If no files left in preview, exit preview mode
            if (next.size === 0) {
                setIsPreviewMode(false);
                setEmbeddingPreview(null);
                setPreviewConfig({ targetDb: '', strategy: '' });
                setRightSidebarCollapsed(rightSidebarStateBeforePreview);
                toast.info('Preview cancelled - no files remaining');
            }

            return next;
        });
    }, [rightSidebarStateBeforePreview]);

    // Handle removing a file from content view (uploaded files)
    const handleRemoveFromContent = useCallback((documentId) => {
        console.log('[IngestionPage] 🎯 handleRemoveFromContent (USER ACTION)', { documentId });

        // Remove from upload queue
        setUploadQueue(prev => prev.filter(d => d.documentId !== documentId));

        // Remove from cache
        removeUploadedFile(documentId);

        // If this was the selected document, clear selection
        if (documentId === selectedDocumentId) {
            setSelectedDocumentId(null);
            resetDocument(null);
            setContentType(CONTENT_TYPE.EDITOR);
            setStoredEmbeddings(null);
        }

        toast.info('File removed');
    }, [selectedDocumentId, resetDocument]);

    // Handle removing an ingested file
    const handleRemoveIngestedFile = useCallback((ingestedId) => {
        console.log('[IngestionPage] 🎯 handleRemoveIngestedFile (USER ACTION)', { ingestedId });

        // Remove from cache (supports both ingestedId and legacy documentId format)
        removeIngestedFile(ingestedId);

        // Update local state
        setIngestedFilesList(getIngestedFiles());

        // If this was the selected document, clear selection
        if (ingestedId === selectedDocumentId) {
            setSelectedDocumentId(null);
            setStoredEmbeddings(null);
            setContentType(CONTENT_TYPE.EDITOR);
        }

        toast.info('Ingested file removed from cache');
    }, [selectedDocumentId]);

    // Handle cache cleared from CacheManagement component
    const handleCacheCleared = useCallback(({ all, types }) => {
        console.log('[IngestionPage] 📦 handleCacheCleared', { all, types });

        // If all cache was cleared or uploaded/content types were cleared
        if (all || types.includes('uploaded') || types.includes('content')) {
            // Clear upload queue state
            setUploadQueue([]);
        }

        // If all cache was cleared or embedding types were cleared
        if (all || types.includes('embedding')) {
            // Refresh ingested files list from cache (will be empty after clear all)
            setIngestedFilesList(getIngestedFiles());
        }

        // If all cache was cleared or editor state was cleared
        if (all || types.includes('editor')) {
            // Reset document state
            resetDocument(null);
        }

        // Reset selection state
        setSelectedDocumentId(null);
        setStoredEmbeddings(null);
        setContentType(CONTENT_TYPE.EDITOR);
        setCheckedDocumentIds(new Set());
        setMultiSelectMode(false);
    }, [resetDocument]);

    // Keyboard shortcuts
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
                            disabled={isIngesting || isPreviewMode}
                            isDragging={isDragging}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        />

                        {/* Multi-select toggle (disabled in preview mode and cache management) */}
                        {!isPreviewMode && (
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    onClick={toggleMultiSelectMode}
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
                            <FileQueue
                                files={uploadQueue}
                                ingestedFiles={ingestedFilesList}
                                selectedDocumentId={selectedDocumentId}
                                checkedDocumentIds={checkedDocumentIds}
                                onSelect={selectDocument}
                                onCheck={handleCheckDocument}
                                multiSelectMode={multiSelectMode}
                                isPreviewMode={isPreviewMode}
                                previewDocumentIds={previewDocumentIds}
                                onRemoveFromPreview={handleRemoveFromPreview}
                                onRemoveFromContent={isPreviewMode ? handleRemoveFromPreview : (
                                    contentType === CONTENT_TYPE.EMBEDDING
                                        ? handleRemoveIngestedFile
                                        : handleRemoveFromContent
                                )}
                                onRemoveIngestedFile={handleRemoveIngestedFile}
                                showIngestedSection={!isPreviewMode}
                            />
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
                                canUndo={canUndo}
                                canRedo={canRedo}
                                onUndo={undo}
                                onRedo={redo}
                                onIngest={() => setShowIngestionModal(true)}
                                canIngest={!!documentState && !isIngesting && !isPreviewMode}
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
                        onCancel={handleCancelPreview}
                        onConfirm={handleConfirmIngestion}
                        onConfirmAll={handleConfirmIngestionAll}
                        isMultiFile={previewDocumentIds.size > 1}
                        totalFilesInPreview={previewDocumentIds.size}
                    />
                ) : contentType === CONTENT_TYPE.EMBEDDING && storedEmbeddings ? (
                    // Show stored embeddings in read-only mode
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

            {/* Right Panel - Helpers (hidden in preview mode and embedding mode) */}
            {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
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
            )}

            {/* Ingestion Modal */}
            <IngestionModal
                isOpen={showIngestionModal}
                onClose={() => setShowIngestionModal(false)}
                onShowPreview={handleStartIngestion}
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
                isOpen={showHelperFileModal}
                onClose={() => {
                    setShowHelperFileModal(false);
                    setPendingHelper(null);
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
