/**
 * ConnectedHelperPanel Component
 * 
 * Helper panel that connects directly to ingestion context.
 * Handles helper execution logic internally.
 * Uses backendConfig for dynamic helper list from backend.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
    useUI,
    useFileQueue,
    useIngestionActions,
    MODAL_TYPES,
    DOC_STATUS,
} from '../../../context/ingestion';
import useBackendConfig from '../../../hooks/useBackendConfig';
import { generateImageDescriptions } from '../../../services/ingestionApi';
import { Commands } from '../../../hooks/useCommandHistory';

export default function ConnectedHelperPanel({ commandState, executeCommand }) {
    const { runningHelper, isIngesting } = useUI();
    const { uploadQueue } = useFileQueue();
    const actions = useIngestionActions();
    const { config: backendConfig } = useBackendConfig();

    // Use commandState (from useCommandHistory) as the document state
    const documentState = commandState;

    const disabled = !documentState || isIngesting;

    // Get helpers from backend config, split by type and filter enabled only
    const localHelpers = useMemo(() => {
        const helpers = backendConfig?.helpers || [];
        return helpers.filter(h => h.type === 'local' && h.enabled);
    }, [backendConfig]);

    const backendHelpers = useMemo(() => {
        const helpers = backendConfig?.helpers || [];
        return helpers.filter(h => h.type === 'backend' && h.enabled);
    }, [backendConfig]);

    // Get all helpers as a flat array for lookup
    const allHelpers = useMemo(() => [...localHelpers, ...backendHelpers], [localHelpers, backendHelpers]);

    // Count ready files (files that helper can be applied to)
    const readyFiles = useMemo(
        () => uploadQueue.filter(f => f.status === DOC_STATUS.READY),
        [uploadQueue]
    );

    // Execute helper directly on current document
    // NOTE: Must be defined BEFORE handleHelperClick since it's called by that function
    const executeHelper = useCallback(async (helperId) => {
        console.log('[ExecuteHelper] Starting helper:', helperId);
        actions.startHelper(helperId);

        try {
            let message = '';

            switch (helperId) {
                case 'remove_logos': {
                    const logoItemIds = [];
                    for (const page of documentState.pages) {
                        for (const item of page.items) {
                            if ((item.type === 'image' || item.type === 'picture') && item.classification === 'logo' && !item.deleted) {
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
                    // Collect all non-deleted images/pictures with their info
                    // Support both 'image' and 'picture' types for compatibility
                    const images = [];

                    // Debug: log document structure
                    console.log('[AI Image Helper] Document state:', {
                        documentId: documentState?.documentId,
                        filename: documentState?.filename,
                        pageCount: documentState?.pages?.length,
                    });

                    if (!documentState?.pages) {
                        console.error('[AI Image Helper] No pages in document state');
                        message = 'No document loaded or document has no pages.';
                        break;
                    }

                    for (const page of documentState.pages) {
                        for (const item of page.items) {
                            // Debug: log each item type
                            console.log(`[AI Image Helper] Page ${page.pageNumber}, Item: ${item.id}, Type: ${item.type}, Deleted: ${item.deleted}`);

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

                    console.log(`[AI Image Helper] Found ${images.length} images:`, images.map(i => ({ id: i.id, classification: i.classification })));

                    if (images.length === 0) {
                        message = 'No images found in document. Make sure the document contains image items.';
                        break;
                    }

                    // Call backend to generate descriptions
                    const result = await generateImageDescriptions(
                        documentState.documentId,
                        images
                    );

                    if (result.success && result.descriptions) {
                        // Create insertions: new text items after each image
                        const insertions = result.descriptions
                            .filter(d => d.description)
                            .map(d => ({
                                afterItemId: d.imageId,
                                newItem: {
                                    id: `desc_${d.imageId}_${Date.now()}`,
                                    type: 'text',
                                    content: `**Image Description:** ${d.description}`,
                                    deleted: false,
                                },
                            }));

                        if (insertions.length > 0) {
                            executeCommand(Commands.batchInsertAfter(insertions));
                        }
                        message = result.message || `Generated descriptions for ${insertions.length} image(s)`;
                    } else {
                        message = result.error || 'Failed to generate descriptions';
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
    }, [documentState, executeCommand, actions]);

    // Handle helper button click
    const handleHelperClick = useCallback((helperId) => {
        console.log('[HelperPanel] Button clicked:', helperId);
        console.log('[HelperPanel] documentState:', documentState ? 'exists' : 'null');
        console.log('[HelperPanel] readyFiles.length:', readyFiles.length);

        if (!documentState) {
            toast.warning('No document loaded to apply helper');
            return;
        }

        // Handle regex helper separately (always shows its own modal)
        if (helperId === 'delete_regex') {
            actions.openModal(MODAL_TYPES.REGEX);
            return;
        }

        // If multiple ready files exist, show file selection modal
        if (readyFiles.length > 1) {
            console.log('[HelperPanel] Multiple files - showing file selection modal');
            const helper = allHelpers.find(h => h.id === helperId);
            actions.setPendingHelper(helper);
            actions.openHelperFileSelectModal();
            return;
        }

        // Only one file - execute directly
        console.log('[HelperPanel] Executing helper directly');
        executeHelper(helperId);
    }, [documentState, readyFiles.length, allHelpers, actions, executeHelper]);

    return (
        <div className="flex-1 p-4 overflow-y-auto">
            {/* Local Helpers */}
            <div className="space-y-2 mb-4">
                <p className="text-xs text-tum-blue font-bold uppercase tracking-wider mb-2">
                    Local
                </p>
                {localHelpers.map((helper) => (
                    <button
                        key={helper.id}
                        onClick={() => handleHelperClick(helper.id)}
                        disabled={disabled || runningHelper === helper.id}
                        className={`
                            w-full px-3 py-2 text-left text-sm transition-all border
                            ${disabled
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-tum-blue-light-5 hover:border-tum-blue'}
                            ${runningHelper === helper.id
                                ? 'bg-tum-blue-light-2 animate-pulse border-tum-blue'
                                : 'bg-white border-transparent'}
                            text-tum-black
                        `}
                        title={helper.description}
                    >
                        <span className="mr-2">{helper.icon}</span>
                        {helper.label}
                        {helper.hasInput && <span className="ml-1 text-xs text-tum-grey-4">...</span>}
                    </button>
                ))}
            </div>

            <hr className="my-3 border-tum-grey-7" />

            {/* Backend/AI Helpers */}
            <div className="space-y-2">
                <p className="text-xs text-tum-blue font-bold uppercase tracking-wider mb-2">
                    AI Powered
                </p>
                {backendHelpers.map((helper) => (
                    <button
                        key={helper.id}
                        onClick={() => handleHelperClick(helper.id)}
                        disabled={disabled || runningHelper === helper.id}
                        className={`
                            w-full px-3 py-2 text-left text-sm transition-all border
                            ${disabled
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-tum-blue-light-5 hover:border-tum-blue'}
                            ${runningHelper === helper.id
                                ? 'bg-tum-blue-light-2 animate-pulse border-tum-blue'
                                : 'bg-white border-transparent'}
                            text-tum-black
                        `}
                        title={helper.description}
                    >
                        <span className="mr-2">{helper.icon}</span>
                        {helper.label}
                    </button>
                ))}
            </div>

            {/* Helper hint */}
            <div className="mt-6 p-3 bg-tum-blue-light-5 border-l-4 border-tum-blue">
                <p className="text-xs text-tum-black">
                    💡 Helpers apply to all pages. Changes can be undone.
                </p>
            </div>
        </div>
    );
}
