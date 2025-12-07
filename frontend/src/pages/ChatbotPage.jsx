import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MessageInput from '../components/MessageInput'
import Conversation from '../components/Conversation'
import { getCurrentUser } from '../services/api'

export default function ChatbotPage() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const userId = currentUser?.id;
    
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [conversationTitles, setConversationTitles] = useState([]);
    const [isFirstMessage, setIsFirstMessage] = useState(false);

    // Redirect to login if user is not authenticated
    useEffect(() => {
        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            navigate('/');
        }
    }, [userId, navigate]);

    const fetchMessages = async () => {
        try {
            const response = await fetch(`http://localhost:4004/api/conversations/${conversationId}/messages`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const previousMessages = await response.json();
            setMessages(previousMessages);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    };

    const fetchConversationTitles = async () => {
        if (!userId) return;
        try {
            const response = await fetch(`http://localhost:4004/api/conversations/user/${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            setConversationTitles(data);
        } catch (error) {
            console.error('Failed to fetch conversation titles:', error);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchConversationTitles();
        }
    }, [userId]);

    useEffect(() => {
        console.log("conversationId changed:", conversationId);
        if (!conversationId) return;
        // Fetch previous messages when conversationId changes  
        if (!isFirstMessage) {
            fetchMessages();
        }  
        if (isFirstMessage) {
            setIsFirstMessage(false);
        }
        
        
    }, [conversationId]);

    


    const handleSendMessage = async (messageText) => {
    if (!userId) {
        console.error('User not authenticated');
        return;
    }
    
    try {
        // If no conversation exists, create one
        let convId = conversationId;
        if (!convId) {
            try {
                setIsFirstMessage(true);
                const res = await fetch('http://localhost:4004/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });
                const data = await res.json();
                convId = data._id;
                setConversationId(convId); // update state for UI
                console.log("Created new conversation on mount:", data);

                // refresh conversation titles in sidebar
                await fetchConversationTitles();
            } catch (error) {
                console.error("Failed to create conversation on mount:", error);
            } 
            
        };

        const userMsg = {
            conversationId: convId,
            sender: 'user',
            content: messageText,
            createdAt: new Date().toISOString()
        };

        // Add user message to UI instantly
        setMessages(prev => [...prev, userMsg]);
        console.log("convId: ", convId);
        console.log("Added user message:", messageText);

        // Send the message to backend
        const msgResponse = await fetch(`http://localhost:4004/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                content: messageText,
                sender: 'user'
            })
        });

        const replyData = await msgResponse.json();

        
        if (replyData?.aiMessage) {
            // Add AI reply to UI
            setMessages(prev => [...prev, replyData.aiMessage]);
            console.log("AI reply added: ", replyData.aiMessage);
        } else {
            console.warn("No aiMessage returned:", replyData);
        }

        // Refresh conversation titles
        const titlesRes = await fetch(`http://localhost:4004/api/conversations/user/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const titlesData = await titlesRes.json();
        setConversationTitles(titlesData); // update sidebar
        console.log("Updated conversation titles:", titlesData);

    } catch (error) {
        console.error('Failed to send message:', error);
    }
};


    // Don't render if user is not authenticated
    if (!userId) {
        return null;
    }

    return (
        <div className="flex h-screen">
            <Sidebar conversationTitles={conversationTitles} setConversationTitles={setConversationTitles} setConversationId={setConversationId} userId={userId}/>  
            <div className="flex flex-col flex-1 overflow-hidden">
                <Conversation messages={messages} />
                <MessageInput onSendMessage={handleSendMessage} />
            </div>
        </div>
    )
}