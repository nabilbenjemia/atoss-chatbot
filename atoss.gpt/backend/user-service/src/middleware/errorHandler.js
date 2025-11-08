/**
 * Error Handler Middleware
 * Global error handling with unified response format
 * {success, data, error, code}
 */

import { HTTP_STATUS, ERROR_CODES } from '../utils/constants.js';

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err);

  // Default error response
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorCode = ERROR_CODES.INTERNAL_ERROR;
  let message = 'Internal server error';

  // Handle known error types
  if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.INVALID_INPUT;
    message = 'Validation error';
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    // Duplicate key error
    statusCode = HTTP_STATUS.CONFLICT;
    errorCode = ERROR_CODES.DUPLICATE_EMAIL;
    message = 'Duplicate entry - email already exists';
  } else if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.INVALID_INPUT;
    message = 'Invalid ID format';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    errorCode = err.code || ERROR_CODES.INTERNAL_ERROR;
    message = err.message;
  }

  // Send error response with unified format
  res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
  });
};

export default errorHandler;
