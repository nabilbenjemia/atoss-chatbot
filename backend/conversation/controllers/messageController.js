const messageService = require('../services/messageService');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');

/** POST /api/conversations/:conversationId/messages */
const createMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { sender, content } = req.body;

    // Validate conversationId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    // Check that conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (!sender || !content) {
      return res.status(400).json({ error: "sender and content are required" });
    }           
    const message = await messageService.createMessage({ conversationId, sender, content });
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to create message", details: error.message });
  }
};

/** GET /api/conversations/:conversationId/messages */
const getMessagesByConversationId = async (req, res) => {
  try {
    const { conversationId } = req.params;
    // Validate conversationId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    // Check that conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const messages = await messageService.getMessagesByConversationId(conversationId);
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
};

/** DELETE /api/messages/:messageId */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    await messageService.deleteMessage(messageId);
    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
};

module.exports = {
  createMessage,
  getMessagesByConversationId,
  deleteMessage,
};
