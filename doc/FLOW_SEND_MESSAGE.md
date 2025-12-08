# Flow Diagram: Send Message Button Click

This document describes the complete flow when a user types a message and clicks the "Send" button (or presses Enter) in the chatbox.

---

## Sequence Diagram

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐
│  User   │    │ MessageInput │    │ ChatbotPage  │    │  Sidebar   │    │  Backend │    │ MongoDB │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └─────┬──────┘    └────┬─────┘    └────┬────┘
     │                │                   │                  │                │               │
     │ 1. Type message│                   │                  │                │               │
     │───────────────>│                   │                  │                │               │
     │                │                   │                  │                │               │
     │ 2. Click "Send"│                   │                  │                │               │
     │   or Enter key │                   │                  │                │               │
     │───────────────>│                   │                  │                │               │
     │                │                   │                  │                │               │
     │                │ 3. handleSend()   │                  │                │               │
     │                │──────────┐        │                  │                │               │
     │                │          │        │                  │                │               │
     │                │<─────────┘        │                  │                │               │
     │                │                   │                  │                │               │
     │                │ 4. onSendMessage  │                  │                │               │
     │                │   (messageText)   │                  │                │               │
     │                │──────────────────>│                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 5. Check if      │                │               │
     │                │                   │    conversationId│                │               │
     │                │                   │    exists        │                │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │   ┌────────────┴───────────────────┴──────────────────┴────────────────┴───────────────┤
     │   │ CASE A: No conversationId (New Conversation)                                       │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │                │                   │                  │                │               │
     │                │                   │ 6a. setIsFirstMessage(true)       │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 7a. POST /api/conversations       │               │
     │                │                   │      {userId}    │                │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ Create new    │
     │                │                   │                  │                │ Conversation  │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ Return convId │
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │ 8a. Return {_id: convId, ...}     │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 9a. setConversationId(convId)     │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 10a. fetchConversationTitles()    │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │                  │                │               │
     │                │                   │ (Updates sidebar)│                │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │   │ CASE B: conversationId exists (Existing Conversation)                              │
     │   │ Skip steps 6a-10a, use existing convId                                             │
     │   └────────────────────────────────────────────────────────────────────────────────────┤
     │                │                   │                  │                │               │
     │                │                   │ 11. Create userMsg object         │               │
     │                │                   │     locally      │                │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 12. setMessages(prev => [...prev, userMsg])       │
     │                │                   │     (Optimistic UI update)        │               │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │ 13. User sees  │                   │                  │                │               │
     │     their msg  │                   │                  │                │               │
     │     instantly  │                   │                  │                │               │
     │<────────────────────────────────── │                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 14. POST /api/conversations/{convId}/messages     │
     │                │                   │     {userId, content, sender:'user'}              │
     │                │                   │─────────────────────────────────>│                │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 15. Validate  │
     │                │                   │                  │                │     convId    │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 16. If title  │
     │                │                   │                  │                │   "Untitled": │
     │                │                   │                  │                │   Update title│
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 17. Save user │
     │                │                   │                  │                │     message   │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 18. Generate  │
     │                │                   │                  │                │     AI reply  │
     │                │                   │                  │                │  (placeholder)│
     │                │                   │                  │                │─────────┐     │
     │                │                   │                  │                │         │     │
     │                │                   │                  │                │<────────┘     │
     │                │                   │                  │                │               │
     │                │                   │                  │                │ 19. Save AI   │
     │                │                   │                  │                │     message   │
     │                │                   │                  │                │──────────────>│
     │                │                   │                  │                │<──────────────│
     │                │                   │                  │                │               │
     │                │                   │ 20. Return {aiMessage: {...}}     │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 21. setMessages(prev => [...prev, aiMessage])     │
     │                │                   │─────────┐        │                │               │
     │                │                   │         │        │                │               │
     │                │                   │<────────┘        │                │               │
     │                │                   │                  │                │               │
     │ 22. User sees  │                   │                  │                │               │
     │     AI reply   │                   │                  │                │               │
     │<────────────────────────────────── │                  │                │               │
     │                │                   │                  │                │               │
     │                │                   │ 23. GET /api/conversations/user/{userId}          │
     │                │                   │     (Refresh titles)              │               │
     │                │                   │─────────────────────────────────> │               │
     │                │                   │<───────────────────────────────── │               │
     │                │                   │                  │                │               │
     │                │                   │ 24. setConversationTitles(data)   │               │
     │                │                   │─────────────────>│                │               │
     │                │                   │                  │                │               │
     │ 25. Sidebar    │                   │                  │                │               │
     │     updated    │                   │                  │                │               │
     │<──────────────────────────────────────────────────────│                │               │
     │                │                   │                  │                │               │
┌────┴────┐    ┌──────┴───────┐    ┌──────┴───────┐    ┌─────┴──────┐    ┌────┴─────┐    ┌────┴────┐
│  User   │    │ MessageInput │    │ ChatbotPage  │    │  Sidebar   │    │  Backend │    │ MongoDB │
└─────────┘    └──────────────┘    └──────────────┘    └────────────┘    └──────────┘    └─────────┘
```

---

## Detailed Step-by-Step Explanation

### Phase 1: User Input Capture (Steps 1-4)

#### Step 1-2: User Types and Sends
User types a message in the textarea and clicks "Send" button or presses Enter.

#### Step 3: MessageInput.handleSend()
```javascript
const handleSend = () => {
    if (message.trim()) {
        onSendMessage(message);      // Call parent's handler
        setMessage("");              // Clear input
        textareaRef.current.style.height = 'auto';  // Reset height
    }
};
```

#### Step 4: Callback to ChatbotPage
The `onSendMessage` prop calls `handleSendMessage(messageText)` in ChatbotPage.

---

### Phase 2: Conversation Creation (Steps 5-10) - Only for New Conversations

#### Step 5: Check Conversation State
```javascript
let convId = conversationId;
if (!convId) {
    // Need to create new conversation first
}
```

#### Steps 6a-10a: Create New Conversation (if needed)
```javascript
setIsFirstMessage(true);
const res = await fetch('http://localhost:4004/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId })
});
const data = await res.json();
convId = data._id;
setConversationId(convId);
await fetchConversationTitles();  // Refresh sidebar
```

**Backend (conversationController.js):**
```javascript
const conversation = await conversationService.createConversation({ 
    userId, 
    title: "Untitled" 
});
```

---

### Phase 3: Optimistic UI Update (Steps 11-13)

#### Step 11-12: Add User Message Immediately
```javascript
const userMsg = {
    conversationId: convId,
    sender: 'user',
    content: messageText,
    createdAt: new Date().toISOString()
};
setMessages(prev => [...prev, userMsg]);  // User sees message instantly
```

This is an **optimistic update** - the message appears before the server confirms it.

---

### Phase 4: Backend Message Processing (Steps 14-20)

#### Step 14: Send to Backend
```javascript
const msgResponse = await fetch(`http://localhost:4004/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: userId,
        content: messageText,
        sender: 'user'
    })
});
```

#### Steps 15-19: Backend Processing (messageController.js)
```javascript
// Step 15: Validate conversation exists
const conversation = await Conversation.findById(conversationId);

// Step 16: Update title if first message
if (conversation.title === "Untitled") {
    const suggestedTitle = "Conv at " + new Date().toLocaleDateString() + " " + 
                          new Date().toLocaleTimeString();
    await conversationService.updateConversationTitle(conversationId, suggestedTitle);
}

// Step 17: Save user message
const userMessage = await messageService.createMessage({ 
    conversationId, sender, content 
});

// Step 18-19: Generate and save AI response
const AIResponse = "This is a placeholder response to your message: " + content;
const AIMessage = await messageService.createMessage({ 
    conversationId, 
    sender: "ai", 
    content: AIResponse 
});

// Step 20: Return AI message
return res.status(201).json({aiMessage: AIMessage});
```

---

### Phase 5: Display AI Response (Steps 21-25)

#### Step 21-22: Add AI Message to UI
```javascript
if (replyData?.aiMessage) {
    setMessages(prev => [...prev, replyData.aiMessage]);
}
```

#### Steps 23-25: Refresh Sidebar
```javascript
const titlesRes = await fetch(`http://localhost:4004/api/conversations/user/${userId}`);
const titlesData = await titlesRes.json();
setConversationTitles(titlesData);  // Updates sidebar with new title
```

---

## Data Flow Summary

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │ MessageInput │───>│ ChatbotPage  │───>│ messages state updated twice:        │  │
│  │              │    │              │    │ 1. User message (optimistic)         │  │
│  │ "Hello AI!"  │    │ handleSend   │    │ 2. AI message (from server)          │  │
│  └──────────────┘    │ Message()    │    └──────────────────────────────────────┘  │
└──────────────────────┼────────────────────────────────────────────────────────────-┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  BACKEND                                           │
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ messageController.createMessage()                                              ││
│  │                                                                                ││
│  │ 1. Validate conversation exists                                                ││
│  │ 2. Update title if "Untitled" (first message)                                  ││
│  │ 3. Save user message to DB                                                     ││
│  │ 4. Generate AI response (placeholder currently)                                ││
│  │ 5. Save AI message to DB                                                       ││
│  │ 6. Return AI message to frontend                                               ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATABASE                                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────────────────┐│
│  │ Conversation        │    │ Messages                                            ││
│  │ {                   │    │ [                                                   ││
│  │   _id: "abc123",    │    │   { sender: "user", content: "Hello AI!", ... },    ││
│  │   title: "Conv at.. │    │   { sender: "ai", content: "Placeholder...", ... }  ││
│  │   userId: "user1"   │    │ ]                                                   ││
│  │ }                   │    │                                                     ││
│  └─────────────────────┘    └─────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Involved

| File | Role |
|------|------|
| `frontend/src/components/MessageInput.jsx` | Captures user input, calls onSendMessage |
| `frontend/src/pages/ChatbotPage.jsx` | Orchestrates message flow, state management |
| `frontend/src/components/Conversation.jsx` | Displays messages |
| `backend/conversation/routes/messageRoutes.js` | Routes POST to controller |
| `backend/conversation/controllers/messageController.js` | Business logic |
| `backend/conversation/services/messageService.js` | Database operations |
| `backend/conversation/models/Message.js` | Mongoose schema |

---

## Important Notes

### 1. Optimistic UI Pattern
User messages appear immediately in the UI before server confirmation. This provides a snappy user experience.

### 2. AI Response is Placeholder
Currently, the AI response is hardcoded:
```javascript
const AIResponse = "This is a placeholder response to your message: " + content;
```
There's a TODO to integrate with a real GenAI service.

### 3. Conversation Title Generation
On the first message, the title changes from "Untitled" to a timestamp-based title. There's a TODO to use AI for generating meaningful titles.

### 4. Error Handling
Errors are caught and logged but not displayed to the user in the current implementation:
```javascript
} catch (error) {
    console.error('Failed to send message:', error);
}
```

---

## Message State Transitions

```
Initial State:
messages = []

After user sends "Hello":
messages = [
    { sender: "user", content: "Hello", createdAt: "2025-12-08T10:30:00Z" }  ← Optimistic
]

After AI responds:
messages = [
    { sender: "user", content: "Hello", createdAt: "2025-12-08T10:30:00Z" },
    { sender: "ai", content: "Placeholder response...", createdAt: "2025-12-08T10:30:01Z" }  ← From server
]
```
