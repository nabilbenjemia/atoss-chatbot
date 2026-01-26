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
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
                {/* Undo/Redo */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="px-2 sm:px-3 py-1.5 text-sm transition-all disabled:opacity-40
                        bg-white border border-tum-blue hover:bg-tum-blue-light-5 text-tum-blue font-bold"
                    title="Undo (Ctrl+Z)"
                >
                    <span className="hidden sm:inline">↩️ </span><span className="sm:hidden">↩️</span><span className="hidden sm:inline">Undo</span>
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="px-2 sm:px-3 py-1.5 text-sm transition-all disabled:opacity-40
                        bg-white border border-tum-blue hover:bg-tum-blue-light-5 text-tum-blue font-bold"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <span className="hidden sm:inline">↪️ </span><span className="sm:hidden">↪️</span><span className="hidden sm:inline">Redo</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* Unsaved indicator */}
                {hasUnsavedChanges && (
                    <span className="text-xs text-tum-orange flex items-center">
                        <span className="w-2 h-2 bg-tum-orange rounded-full mr-1" />
                        <span className="hidden sm:inline">Unsaved</span>
                    </span>
                )}

                {/* Save button */}
                <button
                    onClick={onSave}
                    disabled={!hasUnsavedChanges}
                    className="px-3 sm:px-4 py-1.5 text-sm font-bold transition-all disabled:opacity-40
                        bg-tum-blue hover:bg-tum-dark-blue text-white"
                >
                    Save
                </button>

                {/* Ingest button */}
                <button
                    onClick={onIngest}
                    disabled={!canIngest}
                    className="px-3 sm:px-4 py-1.5 text-sm font-bold transition-all disabled:opacity-40
                        bg-tum-green hover:bg-tum-green text-white"
                >
                    <span className="hidden sm:inline">🚀 </span>Ingest
                </button>
            </div>
        </div>
    );
}
