const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
require('dotenv').config();

/**
 * Learning Material Microservice - handles video tutorials and educational content
 */

const app = express();

// CORS Configuration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

connectDB();

// Middleware MUST be before routes
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Video routes
app.use('/api/videos', require('./routes/videoRoutes'));

// 404 handler - MUST be last
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4005;

app.listen(PORT, () => {
  console.log(`🚀 Learning Material service running on port ${PORT}`);
});