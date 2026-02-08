const mongoose = require('mongoose');
require('dotenv').config();

/**
 * MongoDB connection configuration
 * Connects to database for the Authentication microservice
 */
const connectDB = async () => {
	try {
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/atoss_gpt_auth';
		
		await mongoose.connect(mongoURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		});
		
		console.log('MongoDB connected successfully (Authentication Service)');
	} catch (error) {
		console.error('MongoDB connection error:', error);
		process.exit(1);
	}
};

module.exports = connectDB;

