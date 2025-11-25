const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Database connection
const connectDB = require('./config/database');

// API Gateway
const createApiGateway = require('./gateway/apiGateway');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize API Gateway with routing
createApiGateway(app);

// Error handling middleware
app.use((err, req, res, next) => {
	console.error('Error:', err);
	res.status(err.status || 500).json({
		success: false,
		message: err.message || 'Internal server error'
	});
});

// Start server
const PORT = process.env.PORT || 4000;

const startServer = async () => {
	try {
		// Connect to MongoDB
		await connectDB();
		
		// Start Express server
		app.listen(PORT, () => {
			console.log(`\n🚀 ATOSS.GPT API Gateway running on port ${PORT}`);
			console.log(`📡 Auth Service: Integrated`);
			console.log(`📡 User Service: ${process.env.USER_SERVICE_URL || 'http://localhost:4001'}`);
			console.log(`📡 Chatbot Service: ${process.env.CHATBOT_SERVICE_URL || 'http://localhost:4002'}`);
			console.log(`📡 Learning Service: ${process.env.LEARNING_SERVICE_URL || 'http://localhost:4003'}`);
			console.log(`\n✅ Server ready!\n`);
		});
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
};

startServer();

