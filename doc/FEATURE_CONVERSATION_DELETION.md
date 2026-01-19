# Feature: Conversation Deletion

This document describes the conversation deletion feature, including frontend UI interaction and backend API handling.

---

## Overview

Users can delete individual conversations from the sidebar. The deletion removes both the conversation record and all associated messages from the database.

---

## User Interface Flow

### Visual Representation

```
┌─────────────────────────────────────┐
│ Chats ▼                             │
│ ─────────────────────────────────── │
│ ┌─────────────────────────────────┐ │
│ │ Conv at 12/8/2025...    [🗑️]   │ │  ← Delete icon appears on hover
│ └─────────────────────────────────┘ │
│                                     │
│ After clicking delete icon:         │
│ ┌─────────────────────────────────┐ │
│ │ Conv at 12/8/2025...  [Löschen] │ │  ← Confirmation button
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Interaction Steps

1. **Hover** over a conversation item in the sidebar
2. **Delete icon** (🗑️) appears on the right side
3. **Click** the delete icon
4. **Confirmation button** ("Löschen") appears
5. **Click "Löschen"** to confirm deletion
6. **Click outside** the confirmation button to cancel

---

## Sequence Diagram

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌─────────────────┐    ┌─────────┐
│  User   │    │ Sidebar  │    │ ChatbotPage │    │ Conversation    │    │ MongoDB │
│         │    │          │    │             │    │ Controller      │    │         │
└────┬────┘    └────┬─────┘    └──────┬──────┘    └────────┬────────┘    └────┬────┘
     │              │                 │                    │                  │
     │ 1. Hover on  │                 │                    │                  │
     │    conv item │                 │                    │                  │
     │─────────────>│                 │                    │                  │
     │              │                 │                    │                  │
     │ 2. Show      │                 │                    │                  │
     │    delete    │                 │                    │                  │
     │    icon      │                 │                    │                  │
     │<─────────────│                 │                    │                  │
     │              │                 │                    │                  │
     │ 3. Click     │                 │                    │                  │
     │    delete    │                 │                    │                  │
     │    icon      │                 │                    │                  │
     │─────────────>│                 │                    │                  │
     │              │                 │                    │                  │
     │ 4. Show      │                 │                    │                  │
     │    "Löschen" │                 │                    │                  │
     │    button    │                 │                    │                  │
     │<─────────────│                 │                    │                  │
     │              │                 │                    │                  │
     │ 5. Click     │                 │                    │                  │
     │   "Löschen"  │                 │                    │                  │
     │─────────────>│                 │                    │                  │
     │              │                 │                    │                  │
     │              │ 6. DELETE /api/conversations/{id}    │                  │
     │              │─────────────────────────────────────>│                  │
     │              │                 │                    │                  │
     │              │                 │                    │ 7. Delete        │
     │              │                 │                    │    conversation  │
     │              │                 │                    │─────────────────>│
     │              │                 │                    │<─────────────────│
     │              │                 │                    │                  │
     │              │                 │                    │ 8. Delete        │
     │              │                 │                    │    messages      │
     │              │                 │                    │─────────────────>│
     │              │                 │                    │<─────────────────│
     │              │                 │                    │                  │
     │              │ 9. 200 OK {message: "...deleted"}    │                  │
     │              │<─────────────────────────────────────│                  │
     │              │                 │                    │                  │
     │              │ 10. Filter out  │                    │                  │
     │              │     deleted     │                    │                  │
     │              │     conversation│                    │                  │
     │              │────────────────>│                    │                  │
     │              │                 │                    │                  │
     │              │                 │ 11. setConversationTitles()           │
     │              │                 │     (remove deleted)                  │
     │              │                 │────────┐           │                  │
     │              │                 │        │           │                  │
     │              │                 │<───────┘           │                  │
     │              │                 │                    │                  │
     │              │                 │ 12. setConversationId(null)           │
     │              │                 │────────┐           │                  │
     │              │                 │        │           │                  │
     │              │                 │<───────┘           │                  │
     │              │                 │                    │                  │
     │ 13. UI       │                 │                    │                  │
     │     updated  │                 │                    │                  │
     │<──────────────────────────────│                    │                  │
```

---

## Frontend Implementation

### Component: `Sidebar.jsx`

#### New State Variables
```javascript
const [deleteDropdownId, setDeleteDropdownId] = useState(null);  // Track which conv shows confirm
const deleteDropdownRef = useRef(null);  // Ref for click-outside detection
```

#### Delete Handler Function
```javascript
const handleDeleteConversation = async (convId) => {
  try {
    // Call DELETE API
    const response = await fetch(`http://localhost:4004/api/conversations/${convId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }

    // Update UI after successful deletion
    setConversationTitles(conversationTitles.filter(conv => conv._id !== convId));
    
    // Close the dropdown
    setDeleteDropdownId(null);
    
    // Clear the selection if deleted conversation was active
    setConversationId(null);
    
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    alert("Failed to delete conversation. Please try again.");
  }
};
```

#### Click-Outside Handler
```javascript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (deleteDropdownRef.current && !deleteDropdownRef.current.contains(event.target)) {
      setDeleteDropdownId(null);
    }
  };

  if (deleteDropdownId) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [deleteDropdownId]);
```

#### UI Components
```jsx
<div className={`relative flex-shrink-0 transition-opacity ${
  deleteDropdownId === conv._id 
    ? 'opacity-100' 
    : 'opacity-0 group-hover:opacity-100'
}`}>
  {deleteDropdownId === conv._id ? (
    // Confirmation button
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleDeleteConversation(conv._id);
      }}
      className="w-16 h-5 text-xs text-tum-white bg-red-700 hover:bg-red-800 rounded"
    >
      Löschen
    </button>
  ) : (
    // Delete icon
    <img 
      src={delete_logo} 
      alt="Delete" 
      className="w-4 h-4 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        setDeleteDropdownId(conv._id);
      }}
    />
  )}
</div>
```

---

## Backend Implementation

### Endpoint: `DELETE /api/conversations/:id`

#### Controller: `conversationController.js`

```javascript
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete conversation first
        const deletedConversation = await conversationService.deleteConversation(id);
        if (!deletedConversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        
        // Delete associated messages (don't fail if no messages exist)
        const deletedMessages = await messageService.deleteMessagesByConversationId(id);
        
        res.status(200).json({ 
            message: `Conversation and ${deletedMessages.deletedCount} message(s) deleted successfully` 
        });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: "Failed to delete conversation", details: error.message });
    }
};
```

### Service: `messageService.js`

```javascript
const deleteMessagesByConversationId = async (conversationId) => {
  return await Message.deleteMany({ conversationId });
};

const deleteMessage = async (messageId) => {
  return await Message.findByIdAndDelete(messageId);
};
```

**Note:** The service now returns the result from MongoDB, allowing the controller to access `deletedCount`.

---

## API Response

### Success Response (200)
```json
{
  "message": "Conversation and 5 message(s) deleted successfully"
}
```

### Error Responses

#### Conversation Not Found (404)
```json
{
  "error": "Conversation not found"
}
```

#### Server Error (500)
```json
{
  "error": "Failed to delete conversation",
  "details": "Error message here"
}
```

---

## Key Files

| File | Role |
|------|------|
| `frontend/src/components/Sidebar.jsx` | Delete UI, confirmation dropdown, click handlers |
| `frontend/src/assets/delete_logo.png` | Delete icon asset |
| `frontend/src/assets/index.js` | Asset export including `delete_logo` |
| `backend/conversation/controllers/conversationController.js` | DELETE endpoint handler |
| `backend/conversation/services/messageService.js` | `deleteMessagesByConversationId()` |
| `backend/conversation/services/conversationService.js` | `deleteConversation()` |

---

## Important Notes

1. **Graceful Message Deletion**: The backend no longer fails if the conversation has no messages. It gracefully handles empty conversations.

2. **Optimistic UI Update**: The frontend updates the sidebar immediately after a successful delete, without needing to refetch all conversations.

3. **Selection Clearing**: When a conversation is deleted, if it was currently selected, the selection is cleared (`setConversationId(null)`).

4. **Click-Outside Cancellation**: Clicking outside the confirmation button cancels the deletion and hides the button.

5. **Event Propagation**: `e.stopPropagation()` is used to prevent the click from triggering conversation selection.
