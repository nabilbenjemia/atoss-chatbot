import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const mongoDBName = process.env.MONGODB_DB || 'atoss_gpt_users';
    
    const uri = `${mongoURI}/${mongoDBName}`;
    
    console.log(`[INFO] Connecting to MongoDB: ${uri}`);
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`[SUCCESS] MongoDB connected to database: ${mongoDBName}`);
    
    // Monitor connection events
    mongoose.connection.on('connected', () => {
      console.log(`[MONGOOSE] Connected to MongoDB`);
    });
    
    mongoose.connection.on('error', (err) => {
      console.error(`[MONGOOSE] Connection error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn(`[MONGOOSE] Disconnected from MongoDB`);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error(`[ERROR] Database connection failed: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log(`[SUCCESS] MongoDB connection closed`);
  } catch (error) {
    console.error(`[ERROR] Error closing database connection: ${error.message}`);
    throw error;
  }
};

export { connectDB, disconnectDB };
