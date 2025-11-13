import AIMessage from "./AIMessage";
import UserMessage from "./UserMessage";
import { useState, useEffect, useRef, useLayoutEffect, forwardRef, useImperativeHandle } from "react";

const Conversation = forwardRef((props, ref) => {
    const containerRef = useRef(null);
    
    // Initialize with dummy messages
    const [messages, setMessages] = useState([
        { type: 'user', content: 'Hello, I have a question about my appointment.' },
        { type: 'ai', content: 'Hello! I\'d be happy to help you with your appointment. What would you like to know?' },
        { type: 'user', content: 'When is my next scheduled appointment?' },
        { type: 'ai', content: 'Let me check that for you. Your next appointment is scheduled for November 15, 2025 at 2:30 PM with Dr. Schmidt.' },
        { type: 'user', content: 'Thank you! Can I reschedule it?' },
        { type: 'ai', content: 'Yes, you can reschedule your appointment. What date and time would work better for you?' },
    ]);
    
    const scrollToBottom = () => {
        if (containerRef.current) {
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            });
        }
    };

    const addMessage = (messageText) => {
        // Add user message
        setMessages(prev => [...prev, { type: 'user', content: messageText }]);
        
        // Mock AI response after a delay
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                type: 'ai', 
                content: 'This is a mock AI response. I received your message: "' + messageText + '"'
            }]);
        }, 1000);
    };

    // Expose addMessage to parent via ref
    useImperativeHandle(ref, () => ({
        addMessage
    }));

    useLayoutEffect(() => {
        scrollToBottom();
    });

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
                msg.type === 'user' 
                    ? <UserMessage key={index} message={msg.content} />
                    : <AIMessage key={index} message={msg.content} />
            ))}
        </div>
    )
});

Conversation.displayName = 'Conversation';

export default Conversation;