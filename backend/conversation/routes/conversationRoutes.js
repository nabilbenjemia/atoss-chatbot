const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// Conversation routes
router.post('/', conversationController.createConversation);
router.get('/user/:userId', conversationController.getUserConversations);
router.get('/:id', conversationController.getConversationById);
router.put('/:id', conversationController.updateConversationTitle);
router.delete('/:id', conversationController.deleteConversation);

// ADD: Streaming endpoint
router.get('/:conversationId/stream', messageController.streamMessage);

// MODIFY: Batch save messages after stream completes
router.post('/:conversationId/messages/batch', messageController.createMessageBatch);

module.exports = router;