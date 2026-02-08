const Message = require('../models/Message');

/**
 * Message Service - handles business logic for message management
 */

/**
 * Create a new message
 */
const createMessage = async ({ conversationId, sender, content }) => {
  const message = await Message.create({ conversationId, sender, content });
  return message;
};

/**
 * Get all messages for a conversation
 */
const getMessagesByConversationId = async (conversationId) => {
  return await Message.find({ conversationId }).sort({ createdAt: 1 });
};

/**
 * Delete all messages in a conversation
 */
const deleteMessagesByConversationId = async (conversationId) => {
  return await Message.deleteMany({ conversationId });
};

/**
 * Delete a specific message by ID
 */
const deleteMessage = async (messageId) => {
  return await Message.findByIdAndDelete(messageId);
};

module.exports = {
  createMessage,
  getMessagesByConversationId,
  deleteMessagesByConversationId,
  deleteMessage,
};