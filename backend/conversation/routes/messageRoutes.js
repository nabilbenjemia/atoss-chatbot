const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

/**
 * Message Routes - endpoints for message management within conversations
 */

// Message routes
router.post('/:conversationId/messages', messageController.createMessage);
router.get('/:conversationId/messages', messageController.getMessagesByConversationId);
router.delete('/messages/:messageId', messageController.deleteMessage);

module.exports = router;