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
    res.status(500).json({ error: "Failed to retrieve conversation" });
  }
};

//GET /api/conversations/user/:userId
const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await conversationService.getUserConversations(userId);
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve conversations" });
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
    res.status(500).json({ error: "Failed to update conversation" });
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
        res.status(500).json({ error: "Failed to delete conversation" });
    }
};  

module.exports = {
  createConversation,
  getConversationById,
  getUserConversations,
  updateConversationTitle,
  deleteConversation,
};