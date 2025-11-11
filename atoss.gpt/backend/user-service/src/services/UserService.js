import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { ERROR_CODES } from '../utils/constants.js';

/**
 * User Service - business logic for user profile CRUD operations (US1 scope)
 */
class UserService {
    /**
     * Create a new user
     * @param {Object} payload
     * @param {string} payload.email
     * @param {string} payload.password Raw password
     * @param {string} payload.role
     * @param {string} payload.department
     * @param {string} payload.firstName
     * @param {string} payload.lastName
     * @returns {Promise<Object>} Created user (without passwordHash)
     */
    static async createUser({ email, password, role, department, firstName, lastName }) {
        // Normalize email
        const normalizedEmail = email.toLowerCase();

        // Uniqueness check (application-level early fail)
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            const err = new Error('Email already exists');
            err.statusCode = 409;
            err.code = ERROR_CODES.DUPLICATE_EMAIL;
            throw err;
        }

        const passwordHash = await bcrypt.hash(password, 10); // 10 salt rounds per spec

        const user = await User.create({
            id: uuidv4(),
            email: normalizedEmail,
            passwordHash,
            role,
            department,
            firstName,
            lastName,
            active: true,
        });

        return user.toJSON();
    }

    /**
     * Get a user by UUID (business id) filtering out inactive users
     * @param {string} userId UUID v4 business identifier
     * @returns {Promise<Object|null>} User object or null
     */
    static async getUser(userId) {
        if (!userId) return null;
        const user = await User.findOne({ id: userId, active: true });
        if (!user) return null;
        return user.toJSON();
    }


}

export default UserService;
