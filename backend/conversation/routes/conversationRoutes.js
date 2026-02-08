const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

/**
 * Conversation Routes - endpoints for conversation management and chat streaming
 */

// Conversation routes
router.post('/', conversationController.createConversation);
router.get('/user/:userId', conversationController.getUserConversations);

// Streaming endpoint - MUST be before /:id to avoid route conflict
router.get('/:conversationId/stream', conversationController.streamMessage);

// Batch save messages after stream completes
router.post('/:conversationId/messages/batch', conversationController.createMessageBatch);

// Single conversation CRUD - MUST be after more specific routes
router.get('/:id', conversationController.getConversationById);
router.put('/:id', conversationController.updateConversationTitle);
router.delete('/:id', conversationController.deleteConversation);

module.exports = router;