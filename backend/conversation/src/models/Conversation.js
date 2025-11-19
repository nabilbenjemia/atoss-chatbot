const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    id: {
        type: String,       
        required: true,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString()
    },
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