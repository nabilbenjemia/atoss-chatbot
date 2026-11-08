const express = require('express');
const cors = require("cors");
const ingestionRoutes = require('./routes/ingestionRoutes');
require('dotenv').config();

/**
 * Ingestion Service
 * 
 * Stateless backend service for document ingestion operations.
 * All document state is managed by the frontend (localStorage).
 * This service provides:
 * - Document processing (PDF content extraction via LLM service)
 * - AI helpers (image descriptions, etc.)
 * - Vector DB ingestion
 */

const app = express();
app.use(cors());

// CRITICAL: Middleware MUST be before routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body keys:', Object.keys(req.body));
    }
    next();
});

// Routes
app.use('/api/ingestion', ingestionRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 4006;

app.listen(PORT, () => {
    console.log(`🚀 Ingestion service running on port ${PORT}`);
});
