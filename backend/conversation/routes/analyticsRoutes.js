const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Process unanalyzed queries
router.post('/process', analyticsController.processQueries);

// Get statistics
router.get('/keywords', analyticsController.getKeywordStats);
router.get('/categories', analyticsController.getCategoryStats);
router.get('/timeline', analyticsController.getQueriesOverTime);
router.get('/overall', analyticsController.getOverallStats);

// Get all dashboard data
router.get('/dashboard', analyticsController.getDashboardData);

module.exports = router;
