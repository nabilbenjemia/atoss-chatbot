/**
 * useUndoRedo Hook
 * 
 * A generic undo/redo hook for managing state history.
 * Uses useReducer internally - no external state libraries.
 * 
 * @example
 * const { state, update, undo, redo, canUndo, canRedo, reset } = useUndoRedo(initialState);
 * 
 * // Update state (adds to history)
 * update({ ...state, someField: newValue });
 * 
 * // Undo/redo
 * if (canUndo) undo();
 * if (canRedo) redo();
 */

import { useReducer, useCallback } from 'react';
import { INGESTION_CONFIG } from '../config/ingestionConfig';

// Action types
const UNDO = 'UNDO';
const REDO = 'REDO';
const UPDATE = 'UPDATE';
const RESET = 'RESET';

/**
 * Reducer for undo/redo state management
 */
const undoRedoReducer = (state, action) => {
    const { past, present, future } = state;
    const maxHistory = INGESTION_CONFIG.history.maxUndoSteps;

    switch (action.type) {
        case UNDO: {
            if (past.length === 0) return state;

            const previous = past[past.length - 1];
            const newPast = past.slice(0, -1);

            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        }

        case REDO: {
            if (future.length === 0) return state;

            const next = future[0];
            const newFuture = future.slice(1);

            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        }

        case UPDATE: {
            // If new state is same as current, don't add to history
            if (JSON.stringify(action.payload) === JSON.stringify(present)) {
                return state;
            }

            // Limit history size
            const newPast = [...past, present].slice(-maxHistory);

            return {
                past: newPast,
                present: action.payload,
                future: [], // Clear redo stack on new action
            };
        }

        case RESET: {
            return {
                past: [],
                present: action.payload,
                future: [],
            };
        }

        default:
            return state;
    }
};

/**
 * Custom hook for undo/redo functionality
 * 
 * @param {any} initialState - The initial state value
 * @returns {Object} - Object containing state, update, undo, redo, and status flags
 */
const useUndoRedo = (initialState) => {
    const [state, dispatch] = useReducer(undoRedoReducer, {
        past: [],
        present: initialState,
        future: [],
    });

    /**
     * Update the state (adds to undo history)
     * @param {any} newState - The new state value
     */
    const update = useCallback((newState) => {
        dispatch({ type: UPDATE, payload: newState });
    }, []);

    /**
     * Undo the last action
     */
    const undo = useCallback(() => {
        dispatch({ type: UNDO });
    }, []);

    /**
     * Redo the last undone action
     */
    const redo = useCallback(() => {
        dispatch({ type: REDO });
    }, []);

    /**
     * Reset to a new initial state (clears history)
     * @param {any} newInitialState - The new initial state
     */
    const reset = useCallback((newInitialState) => {
        dispatch({ type: RESET, payload: newInitialState });
    }, []);

    /**
     * Check if undo is available
     */
    const canUndo = state.past.length > 0;

    /**
     * Check if redo is available
     */
    const canRedo = state.future.length > 0;

    /**
     * Get the number of undo steps available
     */
    const undoCount = state.past.length;

    /**
     * Get the number of redo steps available
     */
    const redoCount = state.future.length;

    return {
        state: state.present,
        update,
        undo,
        redo,
        reset,
        canUndo,
        canRedo,
        undoCount,
        redoCount,
    };
};

export default useUndoRedo;
