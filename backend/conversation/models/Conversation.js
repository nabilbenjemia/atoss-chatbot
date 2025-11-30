const mongoose = require('mongoose');

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