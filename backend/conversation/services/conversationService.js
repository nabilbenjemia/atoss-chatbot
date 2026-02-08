const Conversation = require('../models/Conversation');

/**
 * Conversation Service - handles business logic for conversation management
 */

/**
 * Create a new conversation
 */
const createConversation = async ({ userId, title }) => {
  const conversation = await Conversation.create({ userId, title });
  return conversation;
};

/**
 * Get conversation by ID
 */
const getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
};

/**
 * Get all conversations for a user
 */
const getUserConversations = async (userId) => {
  return await Conversation.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Update conversation title
 */
const updateConversationTitle = async (conversationId, newTitle) => {
  return await Conversation.findByIdAndUpdate(
    conversationId,
    { title: newTitle },
    { new: true }
  );
};

/**
 * Delete conversation by ID
 */
const deleteConversation = async (conversationId) => {
  return await Conversation.findByIdAndDelete(conversationId);
};

module.exports = {
  createConversation,
  getConversationById,
  getUserConversations,
  updateConversationTitle,
  deleteConversation,
};

