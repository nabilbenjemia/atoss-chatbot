/**
 * Authentication Middleware
 * Parses mock bearer tokens in format: Bearer <role>:<identifier>
 * Attaches auth data to req.auth
 */

import { HTTP_STATUS, ERROR_CODES, ROLES } from '../utils/constants.js';
import { logAuthToken } from '../utils/logger.js';

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authorization header required',
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Invalid authorization header format. Expected: Bearer <role>:<identifier>',
        code: ERROR_CODES.INVALID_AUTH_TOKEN,
      });
    }

    const token = parts[1];
    const [role, identifier] = token.split(':');

    if (!role || !identifier) {
      logAuthToken(token, null, null, false);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Invalid token format. Expected: <role>:<identifier>',
        code: ERROR_CODES.INVALID_AUTH_TOKEN,
      });
    }

    // Validate role is one of the known roles
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      logAuthToken(token, role, identifier, false);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: `Invalid role: ${role}. Expected one of: ${validRoles.join(', ')}`,
        code: ERROR_CODES.INVALID_AUTH_TOKEN,
      });
    }

    // Attach parsed auth to request
    req.auth = {
      role,
      identifier,
      isAuthenticated: true,
    };

    logAuthToken(token, role, identifier, true);
    next();
  } catch (error) {
    console.error(`[ERROR] Auth middleware error: ${error.message}`);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal server error during authentication',
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export default authMiddleware;
