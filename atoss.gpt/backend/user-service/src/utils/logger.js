/**
 * Logger utility for audit trail and debugging
 * Format: {timestamp, operation, role, userId, targetUserId, status, error, duration}
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getCurrentLogLevel = () => {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[level] || LOG_LEVELS.info;
};

const formatTimestamp = () => {
  return new Date().toISOString();
};

const log = (level, message, data = {}) => {
  const logLevel = getCurrentLogLevel();
  
  if (LOG_LEVELS[level] < logLevel) {
    return;
  }

  const logEntry = {
    timestamp: formatTimestamp(),
    level: level.toUpperCase(),
    message,
    ...data,
  };

  const logString = JSON.stringify(logEntry);

  // Console output
  const colorMap = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  const color = colorMap[level] || '';

  console.log(`${color}${logString}${reset}`);

  // File output (append to daily log file)
  const logFilename = `app-${new Date().toISOString().split('T')[0]}.log`;
  const logFilePath = path.join(logsDir, logFilename);

  fs.appendFileSync(logFilePath, `${logString}\n`, { encoding: 'utf8' });
};

const logCRUDOperation = (operation, authRole, userId, targetUserId, status, error = null, duration = null) => {
  const data = {
    operation,
    authRole,
    userId,
    targetUserId,
    status,
  };

  if (error) data.error = error;
  if (duration !== null) data.durationMs = duration;

  const level = status === 'success' ? 'info' : 'warn';
  log(level, `CRUD Operation: ${operation}`, data);
};

const logAuthToken = (token, role, identifier, isValid) => {
  log('debug', 'Auth Token Parsed', {
    operation: 'AUTH_TOKEN_PARSE',
    role,
    identifier,
    isValid,
  });
};

const logDatabaseError = (operation, error) => {
  log('error', `Database Error in ${operation}`, {
    operation,
    error: error.message || error,
    stack: error.stack,
  });
};

export {
  log,
  logCRUDOperation,
  logAuthToken,
  logDatabaseError,
};
