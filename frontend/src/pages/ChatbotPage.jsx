import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import MessageInput from '../components/MessageInput'
import Conversation from '../components/Conversation'

export default function ChatbotPage() {
    const [conversationId, setConversationId] = useState("69262fd4e5e9636846b8b672");
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!conversationId) return;
        // Fetch previous messages when conversationId changes
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
        fetchMessages();
    }, [conversationId]);

    const handleNewConversation = async () => {
        try {
            const response = await fetch('http://localhost:4004/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'exampleUserId' // TODO: put actual user ID here
                })
            });
            const data = await response.json();
            setConversationId(data._id);
        } catch (error) {
            console.error('Failed to create new conversation:', error);
        }
    };

    const handleSendMessage = async (messageText) => {
        //TODO add loader
    try {
        
        /*
        if (conversationId == null) {
            await handleNewConversation();
        }
        */
       


        setMessages(prev => [...prev, { conversationId: conversationId, sender: 'user', content: messageText }]);
        console.log("added user message:", messageText);

        const response = await fetch(`http://localhost:4004/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'exampleUserId', // TODO: put actual user ID here
                content: messageText,
                sender: 'user'
            })
        });
        const data = await response.json();
        
        console.log("received AI message:", data.aiMessage);

        setMessages(prev => [...prev, data.aiMessage]);
    
    } catch (error) {
        console.error('Failed to send message:', error);
    }
    };

    return (
        <div className="flex h-screen">
            <Sidebar />  
            <div className="flex flex-col flex-1 overflow-hidden">
                <Conversation messages={messages} />
                <MessageInput onSendMessage={handleSendMessage} />
            </div>
        </div>
    )
}