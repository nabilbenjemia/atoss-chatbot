const mongoose = require('mongoose');

// Model for storing analyzed query keywords
const queryAnalyticsSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    query: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        trim: true
    },
    analyzedAt: {
        type: Date,
        default: Date.now
    }
});

queryAnalyticsSchema.index({ userId: 1, analyzedAt: -1 });
queryAnalyticsSchema.index({ keywords: 1 });
queryAnalyticsSchema.index({ category: 1 });

module.exports = mongoose.model('QueryAnalytics', queryAnalyticsSchema);
