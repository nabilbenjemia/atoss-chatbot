const Conversation = require('../models/Conversation');


const createConversation = async ({ userId, title }) => {
  const conversation = await Conversation.create({ userId, title });
  return conversation;
};

const getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
};

const getUserConversations = async (userId) => {
  return await Conversation.find({ userId }).sort({ createdAt: -1 });
};

const updateConversationTitle = async (conversationId, newTitle) => {
  return await Conversation.findByIdAndUpdate(
    conversationId,
    { title: newTitle },
    { new: true }
  );
};

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

