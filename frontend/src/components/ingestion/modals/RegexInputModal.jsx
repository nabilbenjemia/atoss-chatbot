/**
 * RegexInputModal Component
 * 
 * Modal for inputting regex pattern for the "Delete by Regex" helper.
 */

import { useState, useEffect, useRef } from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler (pattern)
 */
export default function RegexInputModal({
    isOpen,
    onClose,
    onConfirm,
}) {
    const [pattern, setPattern] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // Reset and focus when modal opens
    useEffect(() => {
        if (isOpen) {
            setPattern('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Validate and confirm
    const handleConfirm = () => {
        if (!pattern.trim()) {
            setError('Please enter a pattern');
            return;
        }

        // Validate regex
        try {
            new RegExp(pattern);
            onConfirm(pattern);
            onClose();
        } catch {
            setError('Invalid regular expression');
        }
    };

    // Handle enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-tum-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div
                className="bg-white rounded-2xl shadow-xl p-6 w-96 max-w-[90vw] relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-tum-grey-4 hover:text-red-500 bg-transparent hover:bg-red-50 rounded-full p-1 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h2 className="text-lg font-bold text-tum-grey-1 mb-4 pr-8">
                    Delete by Regex
                </h2>

                <p className="text-sm text-tum-grey-4 mb-4">
                    Enter a regular expression pattern. All text items matching this pattern will be marked as deleted.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-tum-grey-1 mb-2">
                        Pattern
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={pattern}
                        onChange={(e) => {
                            setPattern(e.target.value);
                            setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g., ^Chapter \d+$"
                        className={`
                            w-full rounded-xl border px-3 py-2 outline-none transition font-mono text-sm
                            bg-white text-tum-grey-1
                            focus:ring-2 focus:ring-tum-blue-light
                            ${error ? 'border-red-500' : 'border-tum-grey-7 focus:border-tum-blue'}
                        `}
                    />
                    {error && (
                        <p className="text-xs text-red-500 mt-1">{error}</p>
                    )}
                </div>

                <div className="mb-4 p-3 bg-tum-blue-light-4 border border-tum-blue-light-2 rounded-lg">
                    <p className="text-xs text-tum-grey-2">
                        💡 Examples:
                        <br />• <code className="bg-white px-1 rounded">^Page \d+$</code> - Lines starting with "Page" followed by numbers
                        <br />• <code className="bg-white px-1 rounded">TODO</code> - Lines containing "TODO"
                        <br />• <code className="bg-white px-1 rounded">^\s*$</code> - Empty or whitespace-only lines
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl border border-tum-grey-7 text-tum-grey-1
                            bg-white hover:bg-tum-grey-8 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!pattern.trim()}
                        className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white
                            transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Delete Matches
                    </button>
                </div>
            </div>
        </div>
    );
}
