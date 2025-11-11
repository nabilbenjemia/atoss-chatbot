import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { ERROR_CODES, ROLES } from '../utils/constants.js';
import { logCRUDOperation, logDatabaseError } from '../utils/logger.js';

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
        const start = Date.now();
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

        try {
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
            logCRUDOperation('createUser', role, null, user.id, 'success', null, Date.now() - start);
            return user.toJSON();
        } catch (e) {
            logDatabaseError('createUser', e);
            throw e;
        }
    }

    /**
     * Get a user by UUID (business id) filtering out inactive users
     * @param {string} userId UUID v4 business identifier
     * @returns {Promise<Object|null>} User object or null
     */
    static async getUser(userId) {
        if (!userId) return null;
        const start = Date.now();
        try {
            const user = await User.findOne({ id: userId, active: true });
            if (!user) {
                logCRUDOperation('getUser', null, null, userId, 'not_found', null, Date.now() - start);
                return null;
            }
            logCRUDOperation('getUser', null, null, userId, 'success', null, Date.now() - start);
            return user.toJSON();
        } catch (e) {
            logDatabaseError('getUser', e);
            throw e;
        }
    }

    /**
     * Authorization helper for update operations
     * Admin can update any user; Staff can only update self (identifier assumed to match userId in mock env)
     * NOTE: In real auth integration, identifier → userId resolution would be performed via Auth/JWT claims.
     * @param {string} userId
     * @param {string} authRole (Admin|Staff)
     * @param {string} authIdentifier token identifier (mock) assumed userId for Staff
     * @returns {boolean}
     */
    static authorizeUpdate(userId, authRole, authIdentifier) {
        if (authRole === ROLES.ADMIN) return true;
        if (authRole === ROLES.STAFF && authIdentifier === userId) return true;
        return false;
    }

    /**
     * Update a user profile (partial updates allowed)
     * @param {string} userId UUID business id
     * @param {Object} updateData fields to update
     * @param {string} authRole role from req.auth
     * @param {string} authIdentifier identifier from req.auth
     * @returns {Promise<Object>} Updated user JSON
     */
    static async updateUser(userId, updateData = {}, authRole, authIdentifier) {
        const start = Date.now();
        // Fetch existing active user
        const user = await User.findOne({ id: userId, active: true });
        if (!user) {
            const err = new Error('User not found');
            err.statusCode = 404;
            err.code = ERROR_CODES.USER_NOT_FOUND;
            logCRUDOperation('updateUser', authRole, authIdentifier, userId, 'not_found', err.message, Date.now() - start);
            throw err;
        }

        // Authorization
        if (!this.authorizeUpdate(userId, authRole, authIdentifier)) {
            const err = new Error('Forbidden: insufficient privileges to update user');
            err.statusCode = 403;
            err.code = ERROR_CODES.FORBIDDEN;
            throw err;
        }

        // Email uniqueness if changed
        if (updateData.email && updateData.email.toLowerCase() !== user.email) {
            const existing = await User.findOne({ email: updateData.email.toLowerCase(), active: true, id: { $ne: userId } });
            if (existing) {
                const err = new Error('Email already exists');
                err.statusCode = 409;
                err.code = ERROR_CODES.DUPLICATE_EMAIL;
                throw err;
            }
            user.email = updateData.email.toLowerCase();
        }

        // Allowed mutable fields
        const mutable = ['role', 'department', 'firstName', 'lastName'];
        for (const field of mutable) {
            if (updateData[field] !== undefined) {
                user[field] = updateData[field];
            }
        }

        try {
            await user.save();
            logCRUDOperation('updateUser', authRole, authIdentifier, userId, 'success', null, Date.now() - start);
            return user.toJSON();
        } catch (e) {
            logDatabaseError('updateUser', e);
            throw e;
        }
    }

    /**
     * Authorization helper for soft-delete (admin only)
     * @param {string} authRole
     * @returns {boolean}
     */
    static authorizeSoftDelete(authRole) {
        return authRole === ROLES.ADMIN;
    }

    /**
     * Soft delete user (set active=false)
     * @param {string} userId
     * @param {string} authRole
     * @returns {Promise<void>}
     */
    static async softDeleteUser(userId, authRole) {
        const start = Date.now();
        const user = await User.findOne({ id: userId, active: true });
        if (!user) {
            const err = new Error('User not found');
            err.statusCode = 404;
            err.code = ERROR_CODES.USER_NOT_FOUND;
            logCRUDOperation('softDeleteUser', authRole, null, userId, 'not_found', err.message, Date.now() - start);
            throw err;
        }

        if (!this.authorizeSoftDelete(authRole)) {
            const err = new Error('Forbidden: only Admin can delete users');
            err.statusCode = 403;
            err.code = ERROR_CODES.FORBIDDEN;
            throw err;
        }

        try {
            user.active = false;
            await user.save();
            logCRUDOperation('softDeleteUser', authRole, null, userId, 'success', null, Date.now() - start);
        } catch (e) {
            logDatabaseError('softDeleteUser', e);
            throw e;
        }
    }

    /**
     * List users with optional filters and pagination
     * @param {Object} filters {role, department}
     * @param {Object} pagination {limit, offset}
     * @returns {Promise<{users: Object[], total:number, limit:number, offset:number}>}
     */
    static async listUsers(filters = {}, pagination = {}) {
        const start = Date.now();
        const { role, department } = filters;
        let { limit = 50, offset = 0 } = pagination;
        limit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100); // clamp 1..100
        offset = Math.max(parseInt(offset, 10) || 0, 0);

        const query = { active: true };
        if (role) query.role = role;
        if (department) query.department = department;

        try {
            const total = await User.countDocuments(query);
            const users = await User.find(query).skip(offset).limit(limit).sort({ createdAt: -1 });
            logCRUDOperation('listUsers', null, null, null, 'success', null, Date.now() - start);
            return { users: users.map(u => u.toJSON()), total, limit, offset };
        } catch (e) {
            logDatabaseError('listUsers', e);
            throw e;
        }
    }


}

export default UserService;
