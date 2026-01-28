const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const userRoutes = require('./routes/userRoutes');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Frontend origin
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], // Allow all necessary HTTP methods
  credentials: true, // Allow cookies and authentication headers
}));

connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging
app.use((req, res, next) => {
	console.log(`${req.method} ${req.path}`);
	next();
});

// Routes - Gateway routes /users/* to this service, so we mount at root
app.use('/', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
	console.log(`🚀 User service running on port ${PORT}`);
});
