/**
 * ConnectedHelperPanel Component
 * 
 * Helper panel that connects directly to ingestion context.
 * Handles helper execution logic internally.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
    useUI,
    useDocument,
    useIngestionActions,
    MODAL_TYPES,
} from '../../context/ingestion';
import { INGESTION_CONFIG } from '../../config/ingestionConfig';
import { runBackendHelper } from '../../services/ingestionApi';
import { Commands } from '../../hooks/useCommandHistory';

export default function ConnectedHelperPanel({ executeCommand }) {
    const { runningHelper, isIngesting } = useUI();
    const { documentState } = useDocument();
    const actions = useIngestionActions();

    const disabled = !documentState || isIngesting;
    const localHelpers = useMemo(() => INGESTION_CONFIG.helpers.local || [], []);
    const backendHelpers = useMemo(() => INGESTION_CONFIG.helpers.backend || [], []);

    // Execute helper directly on current document
    const executeHelper = useCallback(async (helperId) => {
        if (!documentState) {
            toast.warning('No document loaded to apply helper');
            return;
        }

        // Handle regex helper separately
        if (helperId === 'delete_regex') {
            actions.openModal(MODAL_TYPES.REGEX);
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
    }, [documentState, executeCommand, actions]);

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
                        onClick={() => executeHelper(helper.id)}
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
                        onClick={() => executeHelper(helper.id)}
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

// Export the execute helper for use by file selection modal
export { ConnectedHelperPanel };
