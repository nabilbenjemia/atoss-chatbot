const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Conversation routes
router.post('/:conversationId/messages', messageController.createMessage);

router.get('/:conversationId/messages', messageController.getMessagesByConversationId);
router.delete('/messages/:messageId', messageController.deleteMessage); // TODO: this route doesn't use /api/conversations prefix

module.exports = router;