const Message = require('../models/Message');

const createMessage = async ({ conversationId, sender, content }) => {
  const message = await Message.create({ conversationId, sender, content });
  return message;
};

const getMessagesByConversationId = async (conversationId) => {
  return await Message.find({ conversationId }).sort({ createdAt: 1 });
};

const deleteMessagesByConversationId = async (conversationId) => {
  await Message.deleteMany({ conversationId });
};

const deleteMessage = async (messageId) => {
  await Message.findByIdAndDelete(messageId);
};

module.exports = {
  createMessage,
  getMessagesByConversationId,
  deleteMessagesByConversationId,
  deleteMessage,
};