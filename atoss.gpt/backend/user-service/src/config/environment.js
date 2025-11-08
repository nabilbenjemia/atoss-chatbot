/**
 * Environment configuration
 * Loads and validates required environment variables
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'MONGODB_DB',
  'NODE_ENV',
  'PORT',
  'AUTH_TOKEN_SECRET',
];

const getEnvironmentConfig = () => {
  const config = {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    MONGODB_DB: process.env.MONGODB_DB || 'atoss_gpt_users',
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '4001', 10),
    AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET || 'dev-secret-key',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };

  return config;
};

const validateEnvironment = () => {
  const config = getEnvironmentConfig();
  
  // Validate port is a valid number
  if (isNaN(config.PORT) || config.PORT < 1 || config.PORT > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535`);
  }
  
  // Validate NODE_ENV
  const validEnvs = ['development', 'staging', 'production'];
  if (!validEnvs.includes(config.NODE_ENV)) {
    console.warn(
      `[WARN] NODE_ENV "${config.NODE_ENV}" is not standard. Expected: ${validEnvs.join(', ')}`
    );
  }
  
  // Validate MongoDB URI format
  if (!config.MONGODB_URI.startsWith('mongodb://') && !config.MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error(`Invalid MONGODB_URI format. Must start with "mongodb://" or "mongodb+srv://"`);
  }
  
  console.log(`[INFO] Environment Configuration:`);
  console.log(`  NODE_ENV: ${config.NODE_ENV}`);
  console.log(`  PORT: ${config.PORT}`);
  console.log(`  MONGODB_URI: ${config.MONGODB_URI}`);
  console.log(`  MONGODB_DB: ${config.MONGODB_DB}`);
  console.log(`  LOG_LEVEL: ${config.LOG_LEVEL}`);
  
  return config;
};

export { getEnvironmentConfig, validateEnvironment };
