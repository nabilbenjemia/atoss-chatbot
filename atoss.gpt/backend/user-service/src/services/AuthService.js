/**
 * Authentication Service
 * Mock authentication service for development
 * Parses bearer tokens and validates roles
 */

import { ROLES } from '../utils/constants.js';
import { logAuthToken } from '../utils/logger.js';

class AuthService {
  /**
   * Parse mock bearer token in format: Bearer <role>:<identifier>
   * @param {string} bearerToken - Full bearer token (e.g., "Bearer Admin:user123")
   * @returns {{role: string, identifier: string} | null} Parsed token or null if invalid
   */
  static parseToken(bearerToken) {
    try {
      if (!bearerToken || typeof bearerToken !== 'string') {
        return null;
      }

      const parts = bearerToken.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
      }

      const token = parts[1];
      const [role, identifier] = token.split(':');

      if (!role || !identifier) {
        return null;
      }

      // Validate role
      const validRoles = Object.values(ROLES);
      if (!validRoles.includes(role)) {
        return null;
      }

      return { role, identifier };
    } catch (error) {
      console.error(`[ERROR] Error parsing token: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a role is an admin
   * @param {string} role - Role to check
   * @returns {boolean} True if role is Admin
   */
  static isAdmin(role) {
    return role === ROLES.ADMIN;
  }

  /**
   * Check if a role is staff
   * @param {string} role - Role to check
   * @returns {boolean} True if role is Staff
   */
  static isStaff(role) {
    return role === ROLES.STAFF;
  }

  /**
   * Check if a role can perform admin operations
   * @param {string} role - Role to check
   * @returns {boolean} True if role has admin privileges
   */
  static hasAdminPrivileges(role) {
    return this.isAdmin(role);
  }
}

export default AuthService;
