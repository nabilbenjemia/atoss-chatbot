/**
 * SaveBar Component
 * 
 * Floating save bar with unsaved indicator and undo/redo buttons.
 */

/**
 * @param {Object} props
 * @param {boolean} props.hasUnsavedChanges - Whether there are unsaved changes
 * @param {Function} props.onSave - Save handler
 * @param {boolean} props.canUndo - Whether undo is available
 * @param {boolean} props.canRedo - Whether redo is available
 * @param {Function} props.onUndo - Undo handler
 * @param {Function} props.onRedo - Redo handler
 * @param {Function} props.onIngest - Ingest handler
 * @param {boolean} props.canIngest - Whether ingestion is available
 */
export default function SaveBar({
    hasUnsavedChanges = false,
    onSave,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
    onIngest,
    canIngest = true,
}) {
    return (
        <div className="bg-white border-b border-tum-grey-7 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                {/* Undo/Redo */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-40
                        bg-tum-grey-20 hover:bg-tum-grey-7 text-tum-grey-1"
                    title="Undo (Ctrl+Z)"
                >
                    ↩️ Undo
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-40
                        bg-tum-grey-20 hover:bg-tum-grey-7 text-tum-grey-1"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    ↪️ Redo
                </button>
            </div>

            <div className="flex items-center space-x-3">
                {/* Unsaved indicator */}
                {hasUnsavedChanges && (
                    <span className="text-xs text-orange-500 flex items-center">
                        <span className="w-2 h-2 bg-orange-500 rounded-full mr-1" />
                        Unsaved
                    </span>
                )}

                {/* Save button */}
                <button
                    onClick={onSave}
                    disabled={!hasUnsavedChanges}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40
                        bg-tum-blue hover:bg-tum-dark-blue text-white"
                >
                    Save
                </button>

                {/* Ingest button */}
                <button
                    onClick={onIngest}
                    disabled={!canIngest}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40
                        bg-tum-green-3 hover:bg-tum-green-2 text-white"
                >
                    🚀 Ingest
                </button>
            </div>
        </div>
    );
}
