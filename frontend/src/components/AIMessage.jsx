/**
 * AIMessage Component - Renders AI responses with markdown support
 * 
 * RE-RENDERING DURING STREAMING:
 * Every time a new token arrives:
 * 1. ChatbotPage updates `streamingMessage` state
 * 2. Conversation passes it to AIMessage as `message` prop
 * 3. ReactMarkdown re-parses the ENTIRE content
 * 4. All markdown elements re-render with updated content
 * 
 * This means incomplete blocks (like ```python without closing ```) 
 * render as text until the block is completed.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';

// Image base URL - configure via environment variable
const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:8000/';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4004';

// Custom image renderer to handle different image sources
const ImageRenderer = ({ src, alt }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!src) return;

        // Option 1: MongoDB reference (mongodb:<uuid>)
        if (src.startsWith('mongodb:')) {
            const uuid = src.replace('mongodb:', '');
            setLoading(true);
            setError(null);
            fetch(`${API_BASE_URL}/api/images/${uuid}`)
                .then(res => {
                    if (!res.ok) throw new Error('Image not found');
                    return res.json();
                })
                .then(data => setImageSrc(data.dataUri || `data:${data.mimeType};base64,${data.base64}`))
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
        // Option 2: Relative path (images/<uuid>.png) - resolve with base URL
        // But NOT absolute paths starting with / (which are valid local assets)
        else if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/')) {
            setImageSrc(`${IMAGE_BASE_URL}${src}`);
        }
        // Option 3: Already a full URL, data URI, or absolute path (/)
        else {
            setImageSrc(src);
        }
    }, [src]);

    if (loading) {
        return (
            <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 my-2 h-32">
                <svg className="animate-spin h-6 w-6 text-gray-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Loading image...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2 text-sm text-red-600">
                ⚠️ Failed to load image: {error}
            </div>
        );
    }

    if (!imageSrc) return null;

    return (
        <img
            src={imageSrc}
            alt={alt || 'Image'}
            className="max-w-full h-auto rounded-lg my-2 shadow-sm"
            loading="lazy"
        />
    );
};

// Custom code block renderer with copy button
const CodeBlock = ({ children, className, ...props }) => {
    const [copied, setCopied] = useState(false);
    const isInline = !className;

    if (isInline) {
        // Inline code
        return (
            <code className="bg-gray-300 px-1 rounded text-sm" {...props}>
                {children}
            </code>
        );
    }

    // Block code
    const language = className?.replace('language-', '') || '';
    const code = String(children).replace(/\n$/, '');

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-2">
            {language && (
                <span className="absolute top-2 left-3 text-xs text-gray-400 font-mono">
                    {language}
                </span>
            )}
            <button
                onClick={handleCopy}
                className="absolute right-2 top-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
            >
                {copied ? '✓ Copied' : 'Copy'}
            </button>
            <pre className="bg-gray-800 text-gray-100 p-3 pt-8 rounded-lg overflow-x-auto">
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
};

export default function AIMessage({ message, createdAt, isStreaming }) {
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[70%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-2xl break-words prose prose-sm prose-gray max-w-none
                    prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-2
                    prose-p:my-1 prose-p:leading-relaxed
                    prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                    prose-li:my-0.5
                    prose-strong:text-gray-900
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:pl-3 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:italic prose-blockquote:text-gray-700">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            img: ImageRenderer,
                            code: CodeBlock,
                        }}
                    >
                        {message}
                    </ReactMarkdown>
                    {/* Blinking cursor for streaming indicator */}
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-4 ml-1 bg-gray-500 animate-pulse align-middle">
                        </span>
                    )}
                </div>
                {/* Only show timestamp when not streaming */}
                {createdAt && !isStreaming && (
                    <span className="absolute left-0 -bottom-5 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(createdAt)}
                    </span>
                )}
            </div>
        </div>
    )
}
