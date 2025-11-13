import Sidebar from '../components/Sidebar'
import MessageInput from '../components/MessageInput'

export default function ChatbotLayout() {
    const handleSendMessage = (messageText) => {
        if (conversationRef.current) {
            conversationRef.current.addMessage(messageText);
        }
    };

    return (
        <div className="flex h-screen">
            <Sidebar />  
            <div className="flex flex-col flex-1 overflow-hidden">
                <MessageInput onSendMessage={handleSendMessage} />
            </div>
        </div>
    )
}