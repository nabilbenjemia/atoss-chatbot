const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

/**
 * Analytics Routes - endpoints for query analytics and statistics
 */

// Process unanalyzed queries
router.post('/process', analyticsController.processQueries);

// Get statistics
router.get('/keywords', analyticsController.getKeywordStats);
router.get('/categories', analyticsController.getCategoryStats);
router.get('/timeline', analyticsController.getQueriesOverTime);
router.get('/overall', analyticsController.getOverallStats);

// Get all dashboard data
router.get('/dashboard', analyticsController.getDashboardData);

// Export queries as CSV
router.get('/export', analyticsController.exportQueriesAsCSV);

module.exports = router;
