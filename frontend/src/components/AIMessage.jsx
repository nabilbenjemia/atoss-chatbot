import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AIMessage({ message, createdAt, isStreaming }) {
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
         <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[70%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-2xl break-words prose prose-sm prose-gray max-w-none
                    prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-2
                    prose-p:my-1.5 prose-p:leading-relaxed
                    prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                    prose-li:my-0.5
                    prose-strong:text-gray-900
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:pl-3 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:italic prose-blockquote:text-gray-700
                    prose-code:bg-gray-300 prose-code:px-1 prose-code:rounded prose-code:text-sm
                    prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
