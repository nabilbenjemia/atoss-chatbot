const mongoose = require('mongoose');

/**
 * Video Model - represents tutorial videos in the learning material system
 */
const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Video title is required'],
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    url: {
        type: String,
        required: [true, 'Video URL is required'],
        trim: true
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    thumbnail: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        enum: ['Technisch', 'Anwendung', 'Zeitwirtschaft/Abrechnung', 'Dienstplanung', 'Benutzer & Rollen', 'Prozessfragen', 'Schulung/Doku'],
        default: 'Anwendung'
    },
    tags: [{
        type: String,
        trim: true
    }],
    views: {
        type: Number,
        default: 0
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
videoSchema.index({ title: 'text', description: 'text' });
videoSchema.index({ category: 1 });
videoSchema.index({ createdAt: -1 });

// Instance method to increment views
videoSchema.methods.incrementViews = async function() {
    this.views += 1;
    return this.save();
};

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
