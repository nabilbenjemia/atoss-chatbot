const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    id: {
        type: String,       
        required: true,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString()
    },
    conversationId: {
        type: String,
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