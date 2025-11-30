const mongoose = require('mongoose');
require('dotenv').config();

/**
 * MongoDB connection configuration
 * Connects to UserCredentialsDB for the Authentication microservice
 */
const connectDB = async () => {
	try {
		const mongoURI = process.env.MONGODB_URI;
		
		await mongoose.connect(mongoURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true
		});
		
		console.log('MongoDB connected successfully (UserCredentialsDB)');
	} catch (error) {
		console.error('MongoDB connection error:', error);
		process.exit(1);
	}
};

module.exports = connectDB;

