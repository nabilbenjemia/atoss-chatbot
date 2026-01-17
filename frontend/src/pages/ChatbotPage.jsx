import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MessageInput from '../components/MessageInput'
import Conversation from '../components/Conversation'
import { getCurrentUser } from '../services/api'

const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_URL || 'http://localhost:4004';

export default function ChatbotPage() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const userId = currentUser?.id;

    // Existing state
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [conversationTitles, setConversationTitles] = useState([]);

   // NEW: Streaming states
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState("");
    const eventSourceRef = useRef(null);

    // NEW: Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // NEW: Handle interrupt
    const handleInterrupt = async () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsStreaming(false);

        // Save the partial response if there's content
        if (streamingMessage && messages.length > 0) {
            // Get the last user message (most recent)
            const lastUserMsg = messages.at(-1);
            if (lastUserMsg?.sender === 'user') {
                // Add the partial AI message to messages before saving
                const aiMsg = {
                    sender: 'ai',
                    content: streamingMessage,
                    createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, aiMsg]);

                // Save to DB
                await saveMessages(lastUserMsg.content, streamingMessage);
            }
        }
        setStreamingMessage("");
    };

    // NEW: Save messages to DB
    const saveMessages = async (userMsg, aiMsg) => {
        const isNew = !conversationId;

        try {
            const response = await fetch(
                `${CONVERSATION_API}/api/conversations/${conversationId || 'new'}/messages/batch`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userMessage: userMsg,
                        aiMessage: aiMsg,
                        userId: userId,
                        isNewConversation: isNew
                    })
                }
            );

            const data = await response.json();

            if (isNew) {
                setConversationId(data.conversationId);
            }

            await fetchConversationTitles();
        } catch (error) {
            console.error('Failed to save messages:', error);
        }
    };

    // Redirect to login if user is not authenticated
    useEffect(() => {
        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            navigate('/');
        }
    }, [userId, navigate]);

    const fetchMessages = useCallback(async () => {
        try {
            const response = await fetch(`${CONVERSATION_API}/api/conversations/${conversationId}/messages`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const previousMessages = await response.json();
            setMessages(previousMessages);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, [conversationId]);

    const fetchConversationTitles = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch(`${CONVERSATION_API}/api/conversations/user/${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            setConversationTitles(data);
        } catch (error) {
            console.error('Failed to fetch conversation titles:', error);
        }
    }, [userId]);

    // when user click on different conversation from sidebar
    useEffect(() => {
        if (userId) {
            fetchConversationTitles();
        }
    }, [userId, fetchConversationTitles]);

    useEffect(() => {
    console.log("conversationId changed:", conversationId);
    if (!conversationId || conversationId === 'new') return; // Skip for new conversations

    // Fetch previous messages for existing conversations
    fetchMessages();
}, [conversationId, fetchMessages]);




    // MODIFIED: handleSendMessage with streaming
    const handleSendMessage = async (messageText) => {
        if (!userId || isStreaming) return;
        if (!messageText || messageText.trim() === '') {
            console.error('Empty message text');
            return;
        }

        console.log('Sending message:', messageText);

        try {
            setIsStreaming(true);
            setStreamingMessage("");

            // Add user message to UI (not saved yet)
            const userMsg = {
                conversationId: conversationId,
                sender: 'user',
                content: messageText,
                createdAt: new Date().toISOString(),
                isPending: true  // Mark as pending
            };
            setMessages(prev => [...prev, userMsg]); //

            // Prepare conversation history for context (last 4 messages for context)
            const history = messages.slice(-4).map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            // Create EventSource for streaming
            const convId = conversationId || 'new';
            const url = new URL(`${CONVERSATION_API}/api/conversations/${convId}/stream`);
            url.searchParams.append('query', messageText);
            url.searchParams.append('history', JSON.stringify(history));

            console.log('EventSource URL:', url.toString());

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            let fullResponse = "";

            eventSource.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);

                    if (parsed.done) {
                        // Python sends {"done": true} when complete
                        eventSource.close();
                        eventSourceRef.current = null;
                        setIsStreaming(false);

                        // Add final AI message to state
                        const aiMsg = {
                            sender: 'ai',
                            content: fullResponse,
                            createdAt: new Date().toISOString()
                        };
                        setMessages(prev => [...prev, aiMsg]);
                        setStreamingMessage("");

                        // NOW save both messages to DB
                        saveMessages(messageText, fullResponse);

                    } else if (parsed.error) {
                        console.error('Stream error:', parsed.error);
                        eventSource.close();
                        eventSourceRef.current = null;
                        setIsStreaming(false);

                    } else if (parsed.content !== undefined) {
                        // Python sends {"content": "token"}
                        fullResponse += parsed.content;
                        setStreamingMessage(fullResponse);
                    }
                } catch (e) {
                    // Fallback for non-JSON data
                    console.warn('Non-JSON SSE data:', event.data);
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                eventSource.close();
                eventSourceRef.current = null;
                setIsStreaming(false);
            };

        } catch (error) {
            console.error('Failed to send message:', error);
            setIsStreaming(false);
        }
    };

    // NEW: Handle new chat
    const handleNewChat = () => {
        setConversationId(null);
        setMessages([]);
        setStreamingMessage("");
    };

    // Don't render if user is not authenticated
    if (!userId) {
        return null;
    }

    return (
        <div className="flex h-screen">
            <Sidebar 
                conversationTitles={conversationTitles}
                setConversationTitles={setConversationTitles}
                setConversationId={setConversationId}
                conversationId={conversationId}  
                userId={userId}
                onNewChat={handleNewChat}  // Pass the function
            />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Conversation
                    messages={messages}
                    streamingMessage={streamingMessage}  // NEW prop
                    isStreaming={isStreaming}            // NEW prop
                />
                <MessageInput
                    onSendMessage={handleSendMessage}
                    onInterrupt={handleInterrupt}        // NEW prop
                    isStreaming={isStreaming}            // NEW prop
                />
            </div>
        </div>
    )
}
