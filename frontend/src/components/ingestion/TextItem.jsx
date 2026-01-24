/**
 * TextItem Component
 * 
 * Displays text content with edit mode support.
 * Click to edit raw markdown.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {Object} props.item - Text item object { id, type, content, deleted }
 * @param {Function} props.onEdit - Edit handler (itemId, newContent)
 * @param {Function} props.onDelete - Delete handler (itemId)
 * @param {Function} props.onRestore - Restore handler (itemId)
 */
export default function TextItem({
    item,
    onEdit,
    onDelete,
    onRestore,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(item.content);
    const textareaRef = useRef(null);

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    // Reset edit content when item changes
    useEffect(() => {
        setEditContent(item.content);
    }, [item.content]);

    // Handle save
    const handleSave = useCallback(() => {
        if (editContent !== item.content && onEdit) {
            onEdit(item.id, editContent);
        }
        setIsEditing(false);
    }, [editContent, item.content, item.id, onEdit]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        setEditContent(item.content);
        setIsEditing(false);
    }, [item.content]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSave();
        }
    }, [handleCancel, handleSave]);

    // Deleted state
    if (item.deleted) {
        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7 opacity-50">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-red-500 font-medium">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="text-xs text-tum-blue hover:text-tum-dark-blue"
                        >
                            Restore
                        </button>
                    )}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-tum-grey-4 line-through mt-2">
                    {item.content.slice(0, 100)}...
                </pre>
            </div>
        );
    }

    return (
        <div
            className={`
                bg-white rounded-xl p-4 shadow-sm border transition-all group
                ${isEditing ? 'border-tum-blue ring-2 ring-tum-blue-light' : 'border-tum-grey-7 hover:border-tum-grey-5'}
            `}
        >
            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        className="w-full min-h-[100px] p-2 border border-tum-grey-7 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-tum-blue
                            font-mono text-sm"
                        placeholder="Enter markdown content..."
                    />
                    <div className="flex justify-end space-x-2 text-xs text-tum-grey-4">
                        <span>Ctrl+Enter to save • ESC to cancel</span>
                    </div>
                </div>
            ) : (
                <div
                    className="cursor-text"
                    onClick={() => setIsEditing(true)}
                >
                    <div className="prose prose-sm max-w-none">
                        {/* TODO: Replace with React Markdown rendering */}
                        <pre className="whitespace-pre-wrap font-sans text-sm text-tum-grey-1">
                            {item.content}
                        </pre>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex items-center justify-end space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="text-xs text-tum-blue hover:text-tum-dark-blue"
                        >
                            ✏️ Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item.id);
                                }}
                                className="text-xs text-red-500 hover:text-red-700"
                            >
                                🗑️ Delete
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
