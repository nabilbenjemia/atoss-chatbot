const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://admin:admin@atoss-gpt.5bgviqc.mongodb.net/atoss_gpt_learning?appName=atoss-gpt');
        console.log('✅ MongoDB connected (Learning Material Service)');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;