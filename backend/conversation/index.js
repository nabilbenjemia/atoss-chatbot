const express = require('express');
const cors = require("cors");
const connectDB = require('./config/database');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
require('dotenv').config();

const app = express();
app.use(cors());

connectDB();

// CRITICAL: Middleware MUST be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  next();
});

// Routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4004;

app.listen(PORT, () => {
  console.log(`🚀 Conversation service running on port ${PORT}`);
});

