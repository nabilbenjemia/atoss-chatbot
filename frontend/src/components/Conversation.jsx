import AIMessage from "./AIMessage";
import UserMessage from "./UserMessage";
import { useRef, useLayoutEffect, useEffect } from "react";
import PropTypes from "prop-types";

const Conversation = ({ messages, streamingMessage, isStreaming, isDarkMode }) => { // ADD: new props
    const containerRef = useRef(null);

    const scrollToBottom = () => {
        if (containerRef.current) {
            requestAnimationFrame(() => {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
            });
        }
    };

    useLayoutEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ADD: Scroll when streaming message updates
    useLayoutEffect(() => {
        scrollToBottom();
    }, [streamingMessage]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            scrollToBottom();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className={`flex-1 overflow-y-auto px-16 py-4 ${isDarkMode ? 'bg-[#212121]' : ''}`}>
            {messages.map((msg) => (
                msg.sender === 'user'
                    ? <UserMessage key={msg._id || msg.createdAt} message={msg.content} createdAt={msg.createdAt} />
                    : <AIMessage key={msg._id || msg.createdAt} message={msg.content} createdAt={msg.createdAt} />
            ))}
            
            {/* ADD: Show streaming AI message */}
            {/* Case 1: Waiting for the first word (The Loading Circle) */}
            {isStreaming && !streamingMessage && (
                <div className="flex justify-start mb-4">
                    <div className={`px-4 py-3 rounded-2xl flex items-center space-x-2 ${isDarkMode ? 'bg-[#2f2f2f]' : 'bg-gray-200'}`}>
                        {/* Tailwind Loading Spinner */}
                        <svg className={`animate-spin h-5 w-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Thinking...</span>
                    </div>
                </div>
            )}

            {/* Case 2: Streaming has started (Show text being typed) */}
            {isStreaming && streamingMessage && (
                <AIMessage 
                    message={streamingMessage} 
                    isStreaming={true} 
                />
            )}
        </div>
    );
};

Conversation.propTypes = {
    messages: PropTypes.arrayOf(
        PropTypes.shape({
            _id: PropTypes.string,
            sender: PropTypes.string.isRequired,
            content: PropTypes.string.isRequired,
            createdAt: PropTypes.string,
        })
    ).isRequired,
    streamingMessage: PropTypes.string,
    isStreaming: PropTypes.bool,
    isDarkMode: PropTypes.bool,
};

export default Conversation;