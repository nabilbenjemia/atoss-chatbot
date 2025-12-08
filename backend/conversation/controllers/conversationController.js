const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');

//POST /api/conversations
const createConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Received request from:', { userId }); // Debug log
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    const conversation = await conversationService.createConversation({ userId, title: "Untitled" });
    console.log('Created conversation:', conversation); // Debug log
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error); // Log the actual error
    res.status(500).json({ error: "Failed to create conversation", details: error.message });
  }
};

//GET /api/conversations/:id
const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await conversationService.getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.status(200).json(conversation);
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    res.status(500).json({ error: "Failed to retrieve conversation", details: error.message });
  }
};

//GET /api/conversations/user/:userId
const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await conversationService.getUserConversations(userId);
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error retrieving conversations:', error);
    res.status(500).json({ error: "Failed to retrieve conversations", details: error.message });
  }
};

//PUT /api/conversations/:id
const updateConversationTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "New title is required" });
    }
    const updatedConversation = await conversationService.updateConversationTitle(id, title);
    if (!updatedConversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.status(200).json(updatedConversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: "Failed to update conversation", details: error.message });
  }
};

//DELETE /api/conversations/:id
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedConversation = await conversationService.deleteConversation(id);
        if (!deletedConversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        const deletedMessages = await messageService.deleteMessagesByConversationId(id);
        if (deletedMessages.deletedCount === 0) {
            return res.status(404).json({ error: "Messages not found" });
        }
        res.status(200).json({ message: "Conversation and its " + deletedMessages.deletedCount + " messages were deleted successfully" });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: "Failed to delete conversation", details: error.message });
    }
};

const axios = require('axios');

/** GET /api/conversations/:conversationId/stream?query=... */
const streamMessage = async (req, res) => {
    const { conversationId } = req.params;
    const { query, history } = req.query;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        // Proxy to FastAPI
        const response = await axios({
            method: 'POST',
            url: 'http://localhost:8000/api/generate',
            data: { 
                query, 
                conversation_history: JSON.parse(history || '[]') 
            },
            responseType: 'stream'
        });

        // Pipe the stream to client
        response.data.pipe(res);

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        res.write(`data: [ERROR] ${error.message}\n\n`);
        res.end();
    }
};

/** POST /api/conversations/:conversationId/messages/batch */
const createMessageBatch = async (req, res) => {
    try {
        const { userMessage, aiMessage, userId, isNewConversation } = req.body;

        let convId = null;

        // Create conversation if new
        if (isNewConversation || conversationId === 'new') {
            const newConv = await conversationService.createConversation({ 
                userId, 
                title: "Untitled" 
            });
            convId = newConv._id;
        }

        // Update title if first message
        const conversation = await conversationService.getConversationById(convId);
        if (conversation && conversation.title === "Untitled") {
            // Extract first 30 chars from user message as title
            // TODO: Implement AI-based title generation from userMessage
            const suggestedTitle = userMessage.substring(0, 30) + "...";
            await conversationService.updateConversationTitle(convId, suggestedTitle);
        }

        // Save both messages
        const savedUserMsg = await messageService.createMessage({
            conversationId: convId,
            sender: 'user',
            content: userMessage
        });

        const savedAiMsg = await messageService.createMessage({
            conversationId: convId,
            sender: 'ai',
            content: aiMessage
        });

        res.status(201).json({
            conversationId: convId,
            userMessage: savedUserMsg,
            aiMessage: savedAiMsg
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
  createConversation,
  getConversationById,
  getUserConversations,
  updateConversationTitle,
  deleteConversation,
  streamMessage,        // NEW
  createMessageBatch,   // NEW
};