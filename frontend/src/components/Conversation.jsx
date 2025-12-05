import AIMessage from "./AIMessage";
import UserMessage from "./UserMessage";
import { useRef, useLayoutEffect, useEffect } from "react";

const Conversation = ({ messages }) => {
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
            {messages.map((msg, index) => (
                msg.sender === 'user'
                    ? <UserMessage key={index} message={msg.content} createdAt={msg.createdAt} />
                    : <AIMessage key={index} message={msg.content} createdAt={msg.createdAt} />
            ))}
        </div>
    );
};

export default Conversation;