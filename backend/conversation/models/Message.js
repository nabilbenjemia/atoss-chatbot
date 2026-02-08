const mongoose = require('mongoose');

/**
 * Message Model - represents individual messages within conversations
 */
const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true      
    },
    sender: {
        type: String,
        enum: ['user', 'ai'],
        required: true      
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Message', messageSchema);