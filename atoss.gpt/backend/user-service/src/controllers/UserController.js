import { HTTP_STATUS } from '../utils/constants.js';
import UserService from '../services/UserService.js';

/**
 * User Controller - HTTP handlers for US1 (create, get)
 */
class UserController {
    static async create(req, res, next) {
        try {
            const { email, password, role, department, firstName, lastName } = req.body;
            const user = await UserService.createUser({
                email,
                password,
                role,
                department,
                firstName,
                lastName,
            });
            return res.status(HTTP_STATUS.CREATED).json({ success: true, data: user });
        } catch (err) {
            return next(err);
        }
    }

    static async get(req, res, next) {
        try {
            const { userId } = req.params;
            const user = await UserService.getUser(userId);
            if (!user) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                });
            }
            return res.status(HTTP_STATUS.OK).json({ success: true, data: user });
        } catch (err) {
            return next(err);
        }
    }

    static async update(req, res, next) {
        try {
            const { userId } = req.params;
            const authRole = req?.auth?.role;
            const authIdentifier = req?.auth?.identifier; // mock assumption: identifier === userId for staff self-update
            const updateData = req.body || {};
            const updated = await UserService.updateUser(userId, updateData, authRole, authIdentifier);
            return res.status(HTTP_STATUS.OK).json({ success: true, data: updated });
        } catch (err) {
            return next(err);
        }
    }

    static async delete(req, res, next) {
        try {
            const { userId } = req.params;
            const authRole = req?.auth?.role;
            await UserService.softDeleteUser(userId, authRole);
            return res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (err) {
            return next(err);
        }
    }

    static async list(req, res, next) {
        try {
            const { role, department, limit, offset } = req.query;
            const result = await UserService.listUsers(
                { role, department },
                { limit, offset }
            );
            return res.status(HTTP_STATUS.OK).json({ success: true, data: result });
        } catch (err) {
            return next(err);
        }
    }
}

export default UserController;
