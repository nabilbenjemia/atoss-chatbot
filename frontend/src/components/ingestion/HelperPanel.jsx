/**
 * HelperPanel Component
 * 
 * Sidebar with helper function buttons (local and backend).
 * Loads helpers from configuration.
 */

import { INGESTION_CONFIG } from '../../config/ingestionConfig';

/**
 * @param {Object} props
 * @param {Function} props.onRunHelper - Handler for running a helper (helperId)
 * @param {boolean} props.disabled - Whether helpers are disabled
 * @param {string} props.runningHelper - ID of currently running helper (for loading state)
 */
export default function HelperPanel({
    onRunHelper,
    disabled = false,
    runningHelper = null,
}) {
    const localHelpers = INGESTION_CONFIG.helpers.local || [];
    const backendHelpers = INGESTION_CONFIG.helpers.backend || [];

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
                        onClick={() => onRunHelper && onRunHelper(helper.id)}
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
                        onClick={() => onRunHelper && onRunHelper(helper.id)}
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
