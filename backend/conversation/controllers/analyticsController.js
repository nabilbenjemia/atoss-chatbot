const analyticsService = require('../services/analyticsService');

/**
 * Analytics Controller - handles HTTP requests for conversation analytics and query insights
 */

/**
 * Trigger analysis of unprocessed queries
 */
const processQueries = async (req, res) => {
    try {
        const result = await analyticsService.processUnanalyzedQueries();
        res.json({
            success: true,
            message: `Processed ${result.processed} of ${result.total} queries`,
            ...result
        });
    } catch (error) {
        console.error('Error processing queries:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get keyword statistics
 */
const getKeywordStats = async (req, res) => {
    try {
        const { limit } = req.query;
        const stats = await analyticsService.getKeywordStats(
            null,
            limit ? parseInt(limit) : 20
        );
        res.json(stats);
    } catch (error) {
        console.error('Error getting keyword stats:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get category distribution
 */
const getCategoryStats = async (req, res) => {
    try {
        const stats = await analyticsService.getCategoryStats(null);
        res.json(stats);
    } catch (error) {
        console.error('Error getting category stats:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get queries over time
 */
const getQueriesOverTime = async (req, res) => {
    try {
        const { days } = req.query;
        const stats = await analyticsService.getQueriesOverTime(
            null,
            days ? parseInt(days) : 7
        );
        res.json(stats);
    } catch (error) {
        console.error('Error getting queries over time:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get overall statistics
 */
const getOverallStats = async (req, res) => {
    try {
        const stats = await analyticsService.getOverallStats(null);
        res.json(stats);
    } catch (error) {
        console.error('Error getting overall stats:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get dashboard data (all stats in one call)
 */
const getDashboardData = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await analyticsService.getDashboardData(null, startDate, endDate);
        res.json(data);
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Export analyzed queries as CSV
 */
const exportQueriesAsCSV = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const csv = await analyticsService.exportQueriesAsCSV(null, startDate, endDate);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analyzed_queries.csv"');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting queries:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    processQueries,
    getKeywordStats,
    getCategoryStats,
    getQueriesOverTime,
    getOverallStats,
    getDashboardData,
    exportQueriesAsCSV
};
