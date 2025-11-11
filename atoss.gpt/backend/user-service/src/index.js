import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'atoss_gpt_users';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// MongoDB Connection
const connectDB = async () => {
    try {
        const mongoURI = `${MONGODB_URI}/${MONGODB_DB}`;
        console.log(`[INFO] Connecting to MongoDB: ${mongoURI}`);

        // Mongoose 8+: no need for useNewUrlParser/useUnifiedTopology
        await mongoose.connect(mongoURI);

        console.log(`[SUCCESS] MongoDB connected: ${MONGODB_DB}`);
    } catch (error) {
        console.error(`[ERROR] MongoDB connection failed:`, error.message);
        process.exit(1);
    }
};

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// API Routes (placeholder - to be implemented in Phase 2)
app.use('/api/v1/users', (req, res) => {
    res.status(501).json({
        error: 'Not Implemented',
        message: 'User endpoints coming in Phase 2',
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method,
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(`[ERROR]`, err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
    });
});

// Start Server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`[SUCCESS] User Service running on http://localhost:${PORT}`);
            console.log(`[INFO] Health check: http://localhost:${PORT}/health`);
            console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error(`[ERROR] Failed to start server:`, error);
        process.exit(1);
    }
};

startServer();
