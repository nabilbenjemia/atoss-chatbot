const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const videoRoutes = require('./routes/videoRoutes');
require('dotenv').config();

const app = express();
app.use(cors());

connectDB();

// CRITICAL: Middleware MUST be before routes
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Serve static files (uploaded videos and thumbnails)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  next();
});

// Routes
app.use('/api/videos', videoRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4005;

app.listen(PORT, () => {
  console.log(`🚀 Learning Material service running on port ${PORT}`);
});