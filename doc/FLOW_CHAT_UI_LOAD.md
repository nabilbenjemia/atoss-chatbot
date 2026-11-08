# Flow Diagram: Chat UI Load Sequence

This document describes what happens when the ChatbotPage (Chat UI) is loaded in the browser.

---

## Sequence Diagram

```
┌─────────┐          ┌──────────────┐          ┌─────────┐          ┌──────────┐          ┌─────────┐
│ Browser │          │ ChatbotPage  │          │ Sidebar │          │  Backend │          │ MongoDB │
└────┬────┘          └──────┬───────┘          └────┬────┘          └────┬─────┘          └────┬────┘
     │                      │                       │                    │                     │
     │  Navigate to /chatbot│                       │                    │                     │
     │─────────────────────>│                       │                    │                     │
     │                      │                       │                    │                     │
     │                      │ 1. Component Mounts   │                    │                     │
     │                      │────────────┐          │                    │                     │
     │                      │            │          │                    │                     │
     │                      │<───────────┘          │                    │                     │
     │                      │                       │                    │                     │
     │                      │ 2. getCurrentUser()   │                    │                     │
     │                      │    from localStorage  │                    │                     │
     │                      │────────────┐          │                    │                     │
     │                      │            │          │                    │                     │
     │                      │<───────────┘          │                    │                     │
     │                      │                       │                    │                     │
     │                      │ 3. Check if userId    │                    │                     │
     │                      │    exists             │                    │                     │
     │                      │────────────┐          │                    │                     │
     │                      │            │          │                    │                     │
     │                      │<───────────┘          │                    │                     │
     │                      │                       │                    │                     │
     │     ┌────────────────┴────────────────┐      │                    │                     │
     │     │ IF userId is null/undefined:    │      │                    │                     │
     │     │ Redirect to "/" (Login page)    │      │                    │                     │
     │     └────────────────┬────────────────┘      │                    │                     │
     │                      │                       │                    │                     │
     │     ┌────────────────┴────────────────┐      │                    │                     │
     │     │ IF userId exists (authenticated):│     │                    │                     │
     │     └────────────────┬────────────────┘      │                    │                     │
     │                      │                       │                    │                     │
     │                      │ 4. useEffect triggers │                    │                     │
     │                      │    fetchConversationTitles()               │                     │
     │                      │──────────────────────────────────────────> │                     │
     │                      │                       │                    │                     │
     │                      │              GET /api/conversations/user/{userId}                │
     │                      │                       │                    │──────────────────>  │
     │                      │                       │                    │                     │
     │                      │                       │                    │   Query:            │
     │                      │                       │                    │   Conversation.find │
     │                      │                       │                    │   ({userId})        │
     │                      │                       │                    │   .sort({createdAt: │
     │                      │                       │                    │    -1})             │
     │                      │                       │                    │<──────────────────  │
     │                      │                       │                    │                     │
     │                      │      5. Return array of conversations      │                     │
     │                      │<────────────────────────────────────────── │                     │
     │                      │                       │                    │                     │
     │                      │ 6. setConversationTitles(data)             │                     │
     │                      │────────────┐          │                    │                     │
     │                      │            │          │                    │                     │
     │                      │<───────────┘          │                    │                     │
     │                      │                       │                    │                     │
     │                      │ 7. Render UI          │                    │                     │
     │                      │──────────────────────>│                    │                     │
     │                      │   (pass props:        │                    │                     │
     │                      │    conversationTitles,│                    │                     │
     │                      │    setConversationId, │                    │                     │
     │                      │    userId)            │                    │                     │
     │                      │                       │                    │                     │
     │  8. Display Chat UI  │                       │                    │                     │
     │<─────────────────────│                       │                    │                     │
     │                      │                       │                    │                     │
     │   ┌──────────────────┴──────────────────┐    │                    │                     │
     │   │ UI Rendered with:                   │    │                    │                     │
     │   │ - Sidebar (with conversation list)  │    │                    │                     │
     │   │ - Empty Conversation area           │    │                    │                     │
     │   │ - MessageInput at bottom            │    │                    │                     │
     │   │ - No conversationId selected yet    │    │                    │                     │
     │   └──────────────────────────────────────┘   │                    │                     │
     │                      │                       │                    │                     │
┌────┴────┐          ┌──────┴───────┐          ┌────┴────┐          ┌────┴─────┐          ┌────┴────┐
│ Browser │          │ ChatbotPage  │          │ Sidebar │          │  Backend │          │ MongoDB │
└─────────┘          └──────────────┘          └─────────┘          └──────────┘          └─────────┘
```

---

## Step-by-Step Explanation

### Step 1: Component Mount
When user navigates to `/chatbot`, React Router renders `ChatbotPage` component.

### Step 2: Get Current User
```javascript
const currentUser = getCurrentUser();
const userId = currentUser?.id;
```
The `getCurrentUser()` function reads user data from localStorage that was stored during login.

### Step 3: Authentication Check (First useEffect)
```javascript
useEffect(() => {
    if (!userId) {
        console.log("User not authenticated, redirecting to login.");
        navigate('/');
    }
}, [userId, navigate]);
```
If no userId is found, user is redirected to the login page.

### Step 4: Fetch Conversation Titles (Second useEffect)
```javascript
useEffect(() => {
    if (userId) {
        fetchConversationTitles();
    }
}, [userId]);
```
Once authenticated, the component fetches all conversation titles for the sidebar.

### Step 5: API Call to Backend
```javascript
const fetchConversationTitles = async () => {
    const response = await fetch(`http://localhost:4004/api/conversations/user/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    setConversationTitles(data);
};
```
Backend queries MongoDB for all conversations belonging to this user.

### Step 6: Update State
The returned conversation titles are stored in state, triggering a re-render.

### Step 7: Render UI Components
ChatbotPage renders:
- `Sidebar` component with conversation titles list
- `Conversation` component (empty - no conversation selected yet)
- `MessageInput` component at the bottom

### Step 8: Display Complete
User sees the chat interface:
- Sidebar with their conversation history
- Empty main chat area
- Message input box ready for typing

---

## Initial State After Load

| State Variable | Initial Value | Description |
|----------------|---------------|-------------|
| `conversationId` | `null` | No conversation selected |
| `messages` | `[]` | Empty message array |
| `conversationTitles` | `[{...}]` | Populated from API |
| `isStreaming` | `false` | Whether AI is currently streaming a response |
| `streamingMessage` | `""` | Current streaming message content |

---

## Sidebar Props

| Prop | Type | Description |
|------|------|-------------|
| `conversationTitles` | `Array` | List of conversation objects |
| `setConversationTitles` | `Function` | Setter for updating conversation list (used for deletion) |
| `setConversationId` | `Function` | Setter for selecting a conversation |
| `userId` | `String` | Current user's ID |

---

## Key Files Involved

1. **`frontend/src/pages/ChatbotPage.jsx`** - Main orchestration
2. **`frontend/src/services/api.js`** - `getCurrentUser()` function
3. **`frontend/src/components/Sidebar.jsx`** - Sidebar rendering with delete functionality
4. **`backend/conversation/controllers/conversationController.js`** - API handler
5. **`backend/conversation/services/conversationService.js`** - Database query

---

## What User Sees

After successful load, the user sees:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────┬─────────────────────────────────────────────┐│
│  │ [TUM Klinikum Logo]  │                                             ││
│  │ [−]                  │                                             ││
│  ├──────────────────────│                                             ││
│  │ [+] New chat         │                                             ││
│  │ [🔍] Search chats    │         (Empty - No conversation            ││
│  ├──────────────────────│              selected)                      ││
│  │ Chats ▼              │                                             ││
│  │ ──────────────────── │                                             ││
│  │ Conv at 12/8/2025 🗑️│                                             ││
│  │ Conv at 12/7/2025 🗑️│   (🗑️ appears on hover, click to delete)   ││
│  │ Conv at 12/6/2025 🗑️│                                             ││
│  │                      │                                             ││
│  │                      ├─────────────────────────────────────────────││
│  │ ┌────────────────┐   │ ┌─────────────────────────────────────────┐ ││
│  │ │ [Avatar]       │   │ │ Type your message...             [Send] │ ││
│  │ │ Max Mustermann │   │ └─────────────────────────────────────────┘ ││
│  │ │ TUM Staff      │   │ © Technische Universität München 2026       ││
│  │ └────────────────┘   │                                             ││
│  └──────────────────────┴─────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```
