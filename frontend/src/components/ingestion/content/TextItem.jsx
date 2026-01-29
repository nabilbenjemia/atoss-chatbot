/**
 * TextItem Component
 * 
 * Displays text content with edit mode support.
 * Renders Markdown normally, switches to raw editor on click (like a notebook cell).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

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
            <div className="bg-tum-blue-light-5 p-4 border border-tum-grey-7 opacity-60">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-tum-orange font-bold uppercase">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="px-3 py-1 text-xs font-bold bg-white border border-tum-blue 
                                text-tum-blue hover:bg-tum-blue hover:text-white transition-colors"
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
                bg-white p-4 border transition-all group
                ${isEditing ? 'border-tum-blue ring-1 ring-tum-blue' : 'border-tum-grey-7 hover:border-tum-blue'}
            `}
        >
            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={(e) => {
                            setEditContent(e.target.value);
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        className="w-full min-h-[200px] p-3 border border-tum-grey-7 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-tum-blue
                            font-mono text-sm bg-white text-tum-grey-1 resize-y"
                        placeholder="Enter markdown content..."
                        style={{ height: 'auto', minHeight: Math.max(200, editContent.split('\n').length * 24) + 'px' }}
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
                    <div className="prose prose-sm max-w-none 
                        prose-headings:text-tum-grey-1 prose-headings:font-semibold
                        prose-p:text-tum-grey-1 prose-p:my-2
                        prose-strong:text-tum-grey-1
                        prose-ul:text-tum-grey-1 prose-ol:text-tum-grey-1
                        prose-li:text-tum-grey-1
                        prose-a:text-tum-blue
                        prose-code:text-tum-grey-1 prose-code:bg-tum-grey-8 prose-code:px-1 prose-code:rounded
                        prose-pre:bg-tum-grey-8 prose-pre:text-tum-grey-1">
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-white border border-tum-grey-7 
                                text-tum-blue hover:bg-tum-blue-light-4 hover:border-tum-blue transition-colors"
                        >
                            ✏️ Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item.id);
                                }}
                                className="px-3 py-1 text-xs rounded-md bg-white border border-tum-grey-7 
                                    text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
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
