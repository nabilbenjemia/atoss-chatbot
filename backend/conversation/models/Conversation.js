const mongoose = require('mongoose');

/**
 * Conversation Model - represents a chat conversation between user and AI
 */
const conversationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: String,
        required: true      
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Conversation', conversationSchema);