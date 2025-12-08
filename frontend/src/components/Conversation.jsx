import AIMessage from "./AIMessage";
import UserMessage from "./UserMessage";
import { useRef, useLayoutEffect, useEffect } from "react";
import PropTypes from "prop-types";

const Conversation = ({ messages, streamingMessage, isStreaming }) => { // ADD: new props
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
        <div ref={containerRef} className="flex-1 overflow-y-auto px-16 py-4">
            {messages.map((msg) => (
                msg.sender === 'user'
                    ? <UserMessage key={msg._id || msg.createdAt} message={msg.content} createdAt={msg.createdAt} />
                    : <AIMessage key={msg._id || msg.createdAt} message={msg.content} createdAt={msg.createdAt} />
            ))}
            
            {/* ADD: Show streaming AI message */}
            {isStreaming && streamingMessage && (
                <AIMessage 
                    message={streamingMessage} 
                    isStreaming={true}  // Show typing indicator
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
};

export default Conversation;