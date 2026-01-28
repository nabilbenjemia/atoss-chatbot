/**
 * IngestionPage (Layout-Only)
 * 
 * Admin page for document ingestion workflow.
 * This component is purely for LAYOUT - all business logic is in Connected components.
 * 
 * Layout: Three-panel (File Queue | Content Viewer | Helper Panel)
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md for component breakdown
 * @see doc/ingestion/REDUCER.md for state management documentation
 */

import { useEffect, useCallback } from 'react';
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
} from '../context/ingestion';

// External hooks
import useBackendConfig from '../hooks/useBackendConfig';
import useCommandHistory, { Commands } from '../hooks/useCommandHistory';
import { loadFromCache, clearCache, hasCache } from '../hooks/useLocalCache';

// Utility functions
import { mockCurrentUser, shouldUseMockAuth } from '../mocks/ingestionMocks';
import { getCurrentUser } from '../services/api';
import {
    getUploadedFiles,
    getIngestedFiles,
    saveFileContent,
    updateUploadedFile,
    saveFileHistory,
} from '../utils/fileCacheManager';
import { INGESTION_CONFIG } from '../config/ingestionConfig';

// Connected components (own their business logic)
import ConnectedFileQueue from '../components/ingestion/ConnectedFileQueue';
import ConnectedUploadZone from '../components/ingestion/ConnectedUploadZone';
import ConnectedContentViewer from '../components/ingestion/ConnectedContentViewer';
import ConnectedHelperPanel from '../components/ingestion/ConnectedHelperPanel';

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

    // UI state for layout
    const {
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        isDragging,
        isIngesting,
        ingestionProgress,
        activeModal,
        pendingHelper,
    } = useUI();

    const { uploadQueue, selectedDocumentId } = useFileQueue();
    const { documentState } = useDocument();
    const { isPreviewMode, embeddingPreview, previewConfig, isLoadingPreview } = usePreview();
    const actions = useIngestionActions();

    // Shared command history for undo/redo (used by ContentViewer and HelperPanel)
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

    // Auto-save document content
    useEffect(() => {
        if (documentState && selectedDocumentId) {
            saveFileContent(selectedDocumentId, documentState);
            updateUploadedFile(selectedDocumentId, { filename: documentState.filename });
            const fullState = getDocumentFullState();
            saveFileHistory(selectedDocumentId, fullState);
        }
    }, [documentState, selectedDocumentId, getDocumentFullState]);

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

        // Check for cached edit state
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
    }, [actions, resetCommandDocument]);

    // ===== Modal Handlers =====

    const handleCloseModal = useCallback(() => {
        actions.closeModal();
    }, [actions]);

    const handleShowPreview = useCallback(async (targetDb, strategy) => {
        actions.startPreview(targetDb, strategy);
        // Preview logic is handled by the modal/action
    }, [actions]);

    const handleRegexConfirm = useCallback((pattern) => {
        if (!documentState) return;

        const regex = new RegExp(pattern, 'i');
        const matchingIds = [];

        for (const page of documentState.pages) {
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
    }, [documentState, executeCommand, actions]);

    const handleHelperFileSelectConfirm = useCallback(async () => {
        actions.closeModal();
        // Helper execution logic is in ConnectedHelperPanel
        if (pendingHelper) {
            actions.startHelper(pendingHelper.id);
            // Execute helper on selected files...
        }
    }, [actions, pendingHelper]);

    // ===== Render =====

    if (configLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-tum-grey-4">Loading configuration...</div>
            </div>
        );
    }

    return (
        <div className={`flex h-full overflow-hidden relative ${isDragging ? 'ring-2 ring-tum-blue ring-inset' : ''}`}>
            {/* Left Sidebar - File Queue */}
            <aside
                className={`
                    ${leftSidebarCollapsed ? 'w-0' : 'w-64 lg:w-72'}
                    flex-shrink-0 border-r border-tum-grey-7 bg-white
                    flex flex-col overflow-hidden transition-all duration-300
                `}
            >
                {!leftSidebarCollapsed && (
                    <>
                        {/* Upload Zone */}
                        <div className="p-3 border-b border-tum-grey-7">
                            <ConnectedUploadZone
                                resetCommandDocument={resetCommandDocument}
                                restoreCommandDocument={restoreCommandDocument}
                            />
                        </div>

                        {/* File Queue */}
                        <ConnectedFileQueue
                            resetCommandDocument={resetCommandDocument}
                            restoreCommandDocument={restoreCommandDocument}
                        />

                        {/* Cache Management */}
                        <CacheManagement />
                    </>
                )}
            </aside>

            {/* Toggle Left Sidebar */}
            <button
                onClick={() => actions.toggleLeftSidebar()}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-tum-grey-7 rounded-r-lg p-1 hover:bg-tum-grey-9 transition-colors"
                title={leftSidebarCollapsed ? 'Show file queue' : 'Hide file queue'}
            >
                <svg
                    className={`w-4 h-4 text-tum-grey-4 transition-transform ${leftSidebarCollapsed ? '' : 'rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Main Content - Document Viewer/Editor */}
            <main className="flex-1 flex flex-col overflow-hidden bg-tum-grey-9">
                {isPreviewMode ? (
                    <EmbeddingPreviewViewer
                        preview={embeddingPreview}
                        isLoading={isLoadingPreview}
                        onClose={() => actions.exitPreviewMode()}
                        strategy={previewConfig?.strategy}
                        targetDb={previewConfig?.targetDb}
                        documentState={documentState}
                        onIngest={() => actions.openModal(MODAL_TYPES.INGEST)}
                        isIngesting={isIngesting}
                        progress={ingestionProgress}
                    />
                ) : (
                    <ConnectedContentViewer
                        commandState={{ canUndo, canRedo }}
                        executeCommand={executeCommand}
                        undo={undo}
                        redo={redo}
                    />
                )}
            </main>

            {/* Right Sidebar - Helper Panel */}
            <aside
                className={`
                    ${rightSidebarCollapsed ? 'w-0' : 'w-56 lg:w-64'}
                    flex-shrink-0 border-l border-tum-grey-7 bg-white
                    flex flex-col overflow-hidden transition-all duration-300
                `}
            >
                {!rightSidebarCollapsed && (
                    <>
                        {/* Header */}
                        <div className="p-3 border-b border-tum-grey-7">
                            <h2 className="text-sm font-bold text-tum-grey-1">Helpers</h2>
                            <p className="text-xs text-tum-grey-4 mt-0.5">Auto-clean your content</p>
                        </div>

                        {/* Helper Panel */}
                        <ConnectedHelperPanel executeCommand={executeCommand} />

                        {/* Ingest Button */}
                        <div className="p-3 border-t border-tum-grey-7">
                            <button
                                onClick={() => actions.openModal(MODAL_TYPES.INGEST)}
                                disabled={!documentState || isIngesting}
                                className={`
                                    w-full py-2.5 px-4 rounded-lg font-medium text-sm
                                    transition-all duration-200
                                    ${!documentState || isIngesting
                                        ? 'bg-tum-grey-7 text-tum-grey-4 cursor-not-allowed'
                                        : 'bg-tum-blue text-white hover:bg-tum-dark-blue shadow-sm hover:shadow-md'
                                    }
                                `}
                            >
                                {isIngesting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Ingesting...
                                    </span>
                                ) : (
                                    '🚀 Ingest Document'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </aside>

            {/* Toggle Right Sidebar */}
            <button
                onClick={() => actions.toggleRightSidebar()}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-tum-grey-7 rounded-l-lg p-1 hover:bg-tum-grey-9 transition-colors"
                title={rightSidebarCollapsed ? 'Show helpers' : 'Hide helpers'}
            >
                <svg
                    className={`w-4 h-4 text-tum-grey-4 transition-transform ${rightSidebarCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* ===== Modals ===== */}

            <IngestionModal
                isOpen={activeModal === MODAL_TYPES.INGEST}
                onClose={handleCloseModal}
                onShowPreview={handleShowPreview}
                backendConfig={backendConfig}
                isIngesting={isIngesting}
                progress={ingestionProgress}
            />

            <RegexInputModal
                isOpen={activeModal === MODAL_TYPES.REGEX}
                onClose={handleCloseModal}
                onConfirm={handleRegexConfirm}
            />

            <HelperFileSelectModal
                isOpen={activeModal === MODAL_TYPES.HELPER_FILE_SELECT}
                onClose={handleCloseModal}
                onConfirm={handleHelperFileSelectConfirm}
                files={uploadQueue.map(f => ({
                    documentId: f.documentId,
                    filename: f.filename,
                    status: f.status,
                }))}
                helper={pendingHelper}
                currentDocumentId={selectedDocumentId}
                currentFilename={documentState?.filename}
            />

            {/* Save Bar (shown during ingestion) */}
            {isIngesting && (
                <SaveBar
                    isVisible={isIngesting}
                    progress={ingestionProgress}
                    onCancel={() => actions.cancelIngestion()}
                />
            )}
        </div>
    );
}
