/**
 * useCommandHistory Hook
 * 
 * Command Pattern implementation for undo/redo with memory efficiency.
 * Instead of storing full document snapshots, stores lightweight commands
 * that can be executed (redo) or reversed (undo).
 * 
 * For a 5MB document with 50 undo steps:
 * - Old approach: ~250MB (50 full copies)
 * - Command approach: ~5MB + small command objects
 * 
 * @example
 * const { state, execute, undo, redo, canUndo, canRedo, reset } = useCommandHistory(initialState);
 * 
 * // Execute a command (adds to history)
 * execute(Commands.editItem(itemId, newContent));
 * 
 * // Undo/redo
 * if (canUndo) undo();
 * if (canRedo) redo();
 */

import { useReducer, useCallback, useMemo } from 'react';
import { INGESTION_CONFIG } from '../config/ingestionConfig';

// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

/**
 * Command factory functions
 * Each command has:
 * - type: identifier for debugging
 * - execute(state): returns new state
 * - undo(state): returns previous state (inverse operation)
 */
export const Commands = {
    /**
     * Edit a single item's content
     */
    editItem: (itemId, newContent, oldContent) => ({
        type: 'EDIT_ITEM',
        itemId,
        newContent,
        oldContent,
        execute: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, content: newContent })),
        undo: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, content: oldContent })),
    }),

    /**
     * Delete an item (soft delete)
     */
    deleteItem: (itemId) => ({
        type: 'DELETE_ITEM',
        itemId,
        execute: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, deleted: true })),
        undo: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, deleted: false })),
    }),

    /**
     * Restore a deleted item
     */
    restoreItem: (itemId) => ({
        type: 'RESTORE_ITEM',
        itemId,
        execute: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, deleted: false })),
        undo: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, deleted: true })),
    }),

    /**
     * Change item classification
     */
    changeClass: (itemId, newClass, oldClass) => ({
        type: 'CHANGE_CLASS',
        itemId,
        newClass,
        oldClass,
        execute: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, classification: newClass })),
        undo: (doc) => applyToItem(doc, itemId, (item) => ({ ...item, classification: oldClass })),
    }),

    /**
     * Batch delete multiple items (e.g., from helper functions)
     */
    batchDelete: (itemIds) => ({
        type: 'BATCH_DELETE',
        itemIds,
        execute: (doc) => applyToItems(doc, itemIds, (item) => ({ ...item, deleted: true })),
        undo: (doc) => applyToItems(doc, itemIds, (item) => ({ ...item, deleted: false })),
    }),

    /**
     * Update document filename
     */
    renameDocument: (newFilename, oldFilename) => ({
        type: 'RENAME_DOCUMENT',
        newFilename,
        oldFilename,
        execute: (doc) => ({ ...doc, filename: newFilename }),
        undo: (doc) => ({ ...doc, filename: oldFilename }),
    }),

    /**
     * Batch update items (for AI helpers that modify multiple items)
     * Stores only the changed fields for each item
     */
    batchUpdate: (changes) => ({
        // changes: [{ itemId, newValues: {...}, oldValues: {...} }, ...]
        type: 'BATCH_UPDATE',
        changes,
        execute: (doc) => {
            let result = doc;
            for (const { itemId, newValues } of changes) {
                result = applyToItem(result, itemId, (item) => ({ ...item, ...newValues }));
            }
            return result;
        },
        undo: (doc) => {
            let result = doc;
            for (const { itemId, oldValues } of changes) {
                result = applyToItem(result, itemId, (item) => ({ ...item, ...oldValues }));
            }
            return result;
        },
    }),
};

// ============================================================================
// COMMAND SERIALIZATION (for localStorage persistence)
// ============================================================================

/**
 * Serialize a command to a plain object (removes functions)
 * @param {Object} command - Command object with execute/undo functions
 * @returns {Object} - Serializable command data
 */
export function serializeCommand(command) {
    // Destructure to remove execute/undo functions, keep rest
    const { execute: _execute, undo: _undo, ...data } = command;
    return data;
}

/**
 * Deserialize command data back to a full command with functions
 * @param {Object} data - Serialized command data
 * @returns {Object|null} - Full command object or null if type unknown
 */
export function deserializeCommand(data) {
    if (!data || !data.type) return null;

    switch (data.type) {
        case 'EDIT_ITEM':
            return Commands.editItem(data.itemId, data.newContent, data.oldContent);
        case 'DELETE_ITEM':
            return Commands.deleteItem(data.itemId);
        case 'RESTORE_ITEM':
            return Commands.restoreItem(data.itemId);
        case 'CHANGE_CLASS':
            return Commands.changeClass(data.itemId, data.newClass, data.oldClass);
        case 'BATCH_DELETE':
            return Commands.batchDelete(data.itemIds);
        case 'RENAME_DOCUMENT':
            return Commands.renameDocument(data.newFilename, data.oldFilename);
        case 'BATCH_UPDATE':
            return Commands.batchUpdate(data.changes);
        default:
            console.warn(`[deserializeCommand] Unknown command type: ${data.type}`);
            return null;
    }
}

/**
 * Serialize an array of commands
 */
export function serializeHistory(commands) {
    return commands.map(serializeCommand);
}

/**
 * Deserialize an array of command data
 */
export function deserializeHistory(dataArray) {
    return dataArray.map(deserializeCommand).filter(Boolean);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply a transformation to a single item in the document
 * Uses structural sharing - only creates new objects for changed paths
 */
function applyToItem(doc, itemId, transform) {
    if (!doc?.pages) return doc;

    return {
        ...doc,
        pages: doc.pages.map((page) => {
            // Check if this page contains the item
            const hasItem = page.items?.some((item) => item.id === itemId);
            if (!hasItem) return page; // Structural sharing - same reference

            return {
                ...page,
                items: page.items.map((item) =>
                    item.id === itemId ? transform(item) : item
                ),
            };
        }),
    };
}

/**
 * Apply a transformation to multiple items
 */
function applyToItems(doc, itemIds, transform) {
    if (!doc?.pages) return doc;
    const idSet = new Set(itemIds);

    return {
        ...doc,
        pages: doc.pages.map((page) => {
            // Check if this page contains any of the items
            const hasAnyItem = page.items?.some((item) => idSet.has(item.id));
            if (!hasAnyItem) return page; // Structural sharing

            return {
                ...page,
                items: page.items.map((item) =>
                    idSet.has(item.id) ? transform(item) : item
                ),
            };
        }),
    };
}

// ============================================================================
// REDUCER
// ============================================================================

const EXECUTE = 'EXECUTE';
const UNDO = 'UNDO';
const REDO = 'REDO';
const RESET = 'RESET';
const RESTORE = 'RESTORE';

const commandReducer = (state, action) => {
    const { past, present, future } = state;
    const maxHistory = INGESTION_CONFIG.history.maxUndoSteps;

    switch (action.type) {
        case EXECUTE: {
            const command = action.command;
            const newPresent = command.execute(present);

            // Don't add to history if state didn't change
            if (newPresent === present) return state;

            // Limit history size - commands are small so this is mainly for UX
            const newPast = [...past, command].slice(-maxHistory);

            return {
                past: newPast,
                present: newPresent,
                future: [], // Clear redo stack on new action
            };
        }

        case UNDO: {
            if (past.length === 0) return state;

            const command = past[past.length - 1];
            const newPresent = command.undo(present);

            return {
                past: past.slice(0, -1),
                present: newPresent,
                future: [command, ...future],
            };
        }

        case REDO: {
            if (future.length === 0) return state;

            const command = future[0];
            const newPresent = command.execute(present);

            return {
                past: [...past, command],
                present: newPresent,
                future: future.slice(1),
            };
        }

        case RESET: {
            return {
                past: [],
                present: action.payload,
                future: [],
            };
        }

        case RESTORE: {
            // Restore full state including history
            return {
                past: action.payload.past || [],
                present: action.payload.present,
                future: action.payload.future || [],
            };
        }

        default:
            return state;
    }
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for command-based undo/redo
 * 
 * @param {any} initialState - The initial document state
 * @returns {Object} - State and control functions
 */
const useCommandHistory = (initialState) => {
    const [state, dispatch] = useReducer(commandReducer, {
        past: [],
        present: initialState,
        future: [],
    });

    /**
     * Execute a command (adds to undo history)
     */
    const execute = useCallback((command) => {
        dispatch({ type: EXECUTE, command });
    }, []);

    /**
     * Undo the last command
     */
    const undo = useCallback(() => {
        dispatch({ type: UNDO });
    }, []);

    /**
     * Redo the last undone command
     */
    const redo = useCallback(() => {
        dispatch({ type: REDO });
    }, []);

    /**
     * Reset to a new initial state (clears history)
     */
    const reset = useCallback((newInitialState) => {
        dispatch({ type: RESET, payload: newInitialState });
    }, []);

    /**
     * Restore full state including history (for switching between files)
     * Accepts either serialized (from localStorage) or deserialized commands
     */
    const restore = useCallback((fullState) => {
        // If past/future contain serialized commands, deserialize them
        let past = fullState.past || [];
        let future = fullState.future || [];

        // Check if commands need deserialization (no execute function = serialized)
        if (past.length > 0 && typeof past[0].execute !== 'function') {
            past = deserializeHistory(past);
        }
        if (future.length > 0 && typeof future[0].execute !== 'function') {
            future = deserializeHistory(future);
        }

        dispatch({ type: RESTORE, payload: { past, present: fullState.present, future } });
    }, []);

    /**
     * Get the full internal state (for saving to cache)
     * Returns serialized commands that can be stored in localStorage
     */
    const getFullState = useCallback(() => ({
        past: serializeHistory(state.past),
        present: state.present,
        future: serializeHistory(state.future),
    }), [state.past, state.present, state.future]);

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;
    const undoCount = state.past.length;
    const redoCount = state.future.length;

    // Memoize the return object to prevent unnecessary re-renders
    return useMemo(() => ({
        state: state.present,
        execute,
        undo,
        redo,
        reset,
        restore,
        getFullState,
        canUndo,
        canRedo,
        undoCount,
        redoCount,
    }), [state.present, execute, undo, redo, reset, restore, getFullState, canUndo, canRedo, undoCount, redoCount]);
};

export default useCommandHistory;
