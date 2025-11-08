/**
 * Validation Middleware
 * Validates input data (email format, required fields, enum constraints)
 * Applied to POST and PUT endpoints
 */

import { validateCreateUserInput, validateUpdateUserInput } from '../utils/validators.js';
import { HTTP_STATUS, ERROR_CODES } from '../utils/constants.js';

const validateCreateUserRequest = (req, res, next) => {
  const validation = validateCreateUserInput(req.body);

  if (!validation.valid) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Validation failed',
      code: ERROR_CODES.INVALID_INPUT,
      details: validation.errors,
    });
  }

  next();
};

const validateUpdateUserRequest = (req, res, next) => {
  const validation = validateUpdateUserInput(req.body);

  if (!validation.valid) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Validation failed',
      code: ERROR_CODES.INVALID_INPUT,
      details: validation.errors,
    });
  }

  next();
};

export { validateCreateUserRequest, validateUpdateUserRequest };
