const Message = require('../models/Message');
const QueryAnalytics = require('../models/QueryAnalytics');
const Conversation = require('../models/Conversation');
const llmClassificationService = require('./llmClassificationService');

/**
 * Analytics service for processing and aggregating query data
 */
class AnalyticsService {
    
    /**
     * Analyze all unprocessed user messages
     */
    async processUnanalyzedQueries() {
        try {
            // Get all user messages
            const userMessages = await Message.find({ sender: 'user' }).sort({ createdAt: -1 });
            
            const analyzedIds = await QueryAnalytics.distinct('messageId');
            const analyzedSet = new Set(analyzedIds.map(id => id.toString()));
            
            const unanalyzed = userMessages.filter(msg => !analyzedSet.has(msg._id.toString()));
            
            console.log(`Processing ${unanalyzed.length} unanalyzed queries...`);
            
            let processed = 0;
            for (const message of unanalyzed) {
                try {
                    const { keywords, category } = await llmClassificationService.analyzeQuery(
                        message.content
                    );
                    
                    // Get conversation to find userId
                    const conversation = await Conversation.findById(message.conversationId);
                    const userId = conversation?.userId || 'unknown';
                    
                    await QueryAnalytics.create({
                        messageId: message._id,
                        userId: userId,
                        query: message.content,
                        keywords: keywords,
                        category: category
                    });
                    
                    processed++;
                } catch (err) {
                    console.error(`Error processing message ${message._id}:`, err.message);
                }
            }
            
            console.log(`Processed ${processed} queries successfully`);
            return { processed, total: unanalyzed.length };
            
        } catch (error) {
            console.error('Error in processUnanalyzedQueries:', error);
            throw error;
        }
    }
    
    /**
     * Get keyword frequency statistics
     */
    async getKeywordStats(userId = null, limit = 20, startDate = null, endDate = null) {
        const match = (userId && userId !== 'null') ? { userId } : {};
        
        // Filter by message creation time if dates provided
        if (startDate || endDate) {
            const messageIds = await this._getMessageIdsInDateRange(startDate, endDate);
            match.messageId = { $in: messageIds };
        }
        
        console.log('[getKeywordStats] Match filter:', JSON.stringify(match));
        console.log('[getKeywordStats] Total docs:', await QueryAnalytics.countDocuments({}));
        console.log('[getKeywordStats] Matching docs:', await QueryAnalytics.countDocuments(match));
        
        const results = await QueryAnalytics.aggregate([
            { $match: match },
            { $unwind: '$keywords' },
            { $group: { _id: '$keywords', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit }
        ]);
        
        return results.map(r => ({ keyword: r._id, count: r.count }));
    }
    
    /**
     * Get category distribution
     */
    async getCategoryStats(userId = null, startDate = null, endDate = null) {
        const match = (userId && userId !== 'null') ? { userId } : {};
        
        // Filter by message creation time if dates provided
        if (startDate || endDate) {
            const messageIds = await this._getMessageIdsInDateRange(startDate, endDate);
            match.messageId = { $in: messageIds };
        }
        
        console.log('[getCategoryStats] Match filter:', JSON.stringify(match));
        
        const results = await QueryAnalytics.aggregate([
            { $match: match },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        return results.map(r => ({ category: r._id, count: r.count }));
    }
    
    /**
     * Get queries over time
     */
    async getQueriesOverTime(userId = null, days = 7, startDate = null, endDate = null) {
        const match = (userId && userId !== 'null') ? { userId } : {};
        
        // Filter by message creation time if dates provided
        if (startDate || endDate) {
            const messageIds = await this._getMessageIdsInDateRange(startDate, endDate);
            match.messageId = { $in: messageIds };
        } else {
            // Default to last N days if no date range specified
            const defaultStart = new Date();
            defaultStart.setDate(defaultStart.getDate() - days);
            const messageIds = await this._getMessageIdsInDateRange(defaultStart, null);
            match.messageId = { $in: messageIds };
        }
        
        const results = await QueryAnalytics.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'messages',
                    localField: 'messageId',
                    foreignField: '_id',
                    as: 'message'
                }
            },
            { $unwind: '$message' },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$message.createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        return results.map(r => ({ date: r._id, count: r.count }));
    }
    
    /**
     * Get overall statistics
     */
    async getOverallStats(userId = null, startDate = null, endDate = null) {
        const match = (userId && userId !== 'null') ? { userId } : {};
        
        // Filter by message creation time if dates provided
        if (startDate || endDate) {
            const messageIds = await this._getMessageIdsInDateRange(startDate, endDate);
            match.messageId = { $in: messageIds };
        }
        
        const totalQueries = await QueryAnalytics.countDocuments(match);
        
        // Get unique users who have sent messages (sender: 'user')
        const userMessages = await Message.find({ sender: 'user' }).distinct('conversationId');
        const conversationsWithUserMessages = await Conversation.find({
            _id: { $in: userMessages }
        }).distinct('userId');
        
        const validUserIds = conversationsWithUserMessages.filter(id => 
            id && 
            id !== 'unknown' && 
            id !== 'null' && 
            id !== null && 
            id !== undefined
        );
        console.log('[getOverallStats] Users with messages:', conversationsWithUserMessages.length);
        console.log('[getOverallStats] Valid userIds:', validUserIds);
        const uniqueUsers = validUserIds.length;
        
        // Get active users (last 15 minutes)
        const now = new Date();
        const last15Minutes = new Date(now.getTime() - 15 * 60 * 1000);
        
        const recentMessages = await Message.find({ 
            sender: 'user',
            createdAt: { $gte: last15Minutes }
        }).distinct('conversationId');
        
        const activeConversations = await Conversation.find({
            _id: { $in: recentMessages }
        }).distinct('userId');
        
        const activeUsersNow = activeConversations.filter(id => 
            id && id !== 'unknown' && id !== 'null' && id !== null && id !== undefined
        ).length;
        
        const avgKeywordsPerQuery = await QueryAnalytics.aggregate([
            { $match: match },
            { $project: { keywordCount: { $size: '$keywords' } } },
            { $group: { _id: null, avg: { $avg: '$keywordCount' } } }
        ]);
        
        return {
            totalQueries,
            uniqueUsers,
            activeUsersNow,
            avgKeywordsPerQuery: Math.round((avgKeywordsPerQuery[0]?.avg || 0) * 10) / 10
        };
    }
    
    /**
     * Get all dashboard data in one call
     */
    async getDashboardData(userId = null, startDate = null, endDate = null) {
        const [overall, keywords, categories, timeline] = await Promise.all([
            this.getOverallStats(userId, startDate, endDate),
            this.getKeywordStats(userId, 15, startDate, endDate),
            this.getCategoryStats(userId, startDate, endDate),
            this.getQueriesOverTime(userId, 30, startDate, endDate)
        ]);
        
        return {
            overall,
            keywords,
            categories,
            timeline
        };
    }
    
    /**
     * Helper: Get message IDs within date range
     */
    async _getMessageIdsInDateRange(startDate, endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        
        const messages = await Message.find({
            sender: 'user',
            createdAt: dateFilter
        }).select('_id');
        
        return messages.map(m => m._id);
    }

    /**
     * Export analyzed queries as CSV
     */
    async exportQueriesAsCSV(userId = null, startDate = null, endDate = null) {
        const match = (userId && userId !== 'null') ? { userId } : {};
        
        // Filter by message creation time if dates provided
        if (startDate || endDate) {
            const messageIds = await this._getMessageIdsInDateRange(startDate, endDate);
            match.messageId = { $in: messageIds };
        }
        
        // Get all matching queries sorted by date
        const queries = await QueryAnalytics.find(match)
            .populate({
                path: 'messageId',
                select: 'createdAt'
            })
            .sort({ 'messageId.createdAt': -1 });
        
        // Generate CSV
        let csv = 'Query,Keywords,Category,Query Time\n';
        
        for (const query of queries) {
            const queryText = this._escapeCsvField(query.query);
            const keywords = this._escapeCsvField(query.keywords.join(', '));
            const category = this._escapeCsvField(query.category);
            const timestamp = query.messageId && query.messageId.createdAt 
                ? new Date(query.messageId.createdAt).toLocaleString() 
                : '';
            
            csv += `${queryText},${keywords},${category},${timestamp}\n`;
        }
        
        return csv;
    }
    }

    /**
     * Helper: Escape CSV field (handle quotes and commas)
     */
    _escapeCsvField(field) {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
}

module.exports = new AnalyticsService();
