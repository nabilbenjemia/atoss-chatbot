const userService = require('../services/UserService');

/**
 * UserController
 * Entry point for user management HTTP requests
 */
class UserController {
	/**
	 * Get current user profile
	 * GET /users/me
	 */
	async getProfile(req, res) {
		try {
			const userId = req.user?.id;
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const profile = await userService.getUserProfile(userId, token);

			res.status(200).json({
				success: true,
				data: profile
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: error.message || 'Failed to fetch user profile'
			});
		}
	}

	/**
	 * Get user profile by ID (for verification endpoint)
	 * GET /users/:userId/verify
	 */
	async verifyUser(req, res) {
		try {
			const { userId } = req.params;

			const exists = await userService.verifyUserExists(userId);

			res.status(200).json({
				success: true,
				exists
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				exists: false,
				message: error.message || 'Failed to verify user'
			});
		}
	}

	/**
	 * Update username
	 * PATCH /users/me/username
	 */
	async updateUsername(req, res) {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { username } = req.body;

			const result = await userService.updateUsername(userId, username);

			res.status(200).json({
				success: true,
				message: 'Username updated successfully',
				data: result
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update username'
			});
		}
	}

	/**
	 * Update user role
	 * PATCH /users/me/role
	 */
	async updateRole(req, res) {
		try {
			const userId = req.user?.id;
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { role } = req.body;

			if (!role) {
				return res.status(400).json({
					success: false,
					message: 'Role is required'
				});
			}

			const result = await userService.updateRole(userId, role, token);

			res.status(200).json({
				success: true,
				message: 'Role updated successfully',
				data: result
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update role'
			});
		}
	}

	/**
	 * Update user department
	 * PATCH /users/me/department
	 */
	async updateDepartment(req, res) {
		try {
			const userId = req.user?.id;
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { department } = req.body;

			if (!department) {
				return res.status(400).json({
					success: false,
					message: 'Department is required'
				});
			}

			const result = await userService.updateDepartment(userId, department, token);

			res.status(200).json({
				success: true,
				message: 'Department updated successfully',
				data: result
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update department'
			});
		}
	}

	/**
	 * Update user password
	 * PATCH /users/me/password
	 */
	async updatePassword(req, res) {
		try {
			const userId = req.user?.id;
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { currentPassword, newPassword } = req.body;

			if (!currentPassword || !newPassword) {
				return res.status(400).json({
					success: false,
					message: 'Current password and new password are required'
				});
			}

			const result = await userService.updatePassword(userId, currentPassword, newPassword, token);

			res.status(200).json({
				success: true,
				message: result.message || 'Password updated successfully'
			});
		} catch (error) {
			const statusCode = error.message.includes('incorrect') ? 401 : 400;
			res.status(statusCode).json({
				success: false,
				message: error.message || 'Failed to update password'
			});
		}
	}

	/**
	 * Update user preferences
	 * PATCH /users/me/preferences
	 */
	async updatePreferences(req, res) {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { preferences } = req.body;

			if (!preferences || typeof preferences !== 'object') {
				return res.status(400).json({
					success: false,
					message: 'Preferences object is required'
				});
			}

			const result = await userService.updatePreferences(userId, preferences);

			res.status(200).json({
				success: true,
				message: 'Preferences updated successfully',
				data: result
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update preferences'
			});
		}
	}

	/**
	 * Delete user account
	 * DELETE /users/me
	 */
	async deleteAccount(req, res) {
		try {
			const userId = req.user?.id;
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			await userService.deleteAccount(userId, token);

			res.status(200).json({
				success: true,
				message: 'Account deleted successfully'
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: error.message || 'Failed to delete account'
			});
		}
	}
}

module.exports = new UserController();
