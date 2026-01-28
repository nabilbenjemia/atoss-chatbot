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
			console.error('Error updating username:', error);
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
			console.error('Error updating role:', error);
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
			console.error('Error updating department:', error);
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

	/**
	 * Update profile picture
	 * PATCH /users/me/profile-picture
	 */
	async updateProfilePicture(req, res) {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const { profilePicture } = req.body;

			const result = await userService.updateProfilePicture(userId, profilePicture);

			res.status(200).json({
				success: true,
				message: 'Profile picture updated successfully',
				data: result
			});
		} catch (error) {
			console.error('Error updating profile picture:', error);
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update profile picture'
			});
		}
	}

	/**
	 * Delete profile picture
	 * DELETE /users/me/profile-picture
	 */
	async deleteProfilePicture(req, res) {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			const result = await userService.deleteProfilePicture(userId);

			res.status(200).json({
				success: true,
				message: 'Profile picture deleted successfully',
				data: result
			});
		} catch (error) {
			console.error('Error deleting profile picture:', error);
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to delete profile picture'
			});
		}
	}

	/**
	 * Add admin - promote a staff user to admin by email
	 * POST /users/add-admin
	 * Only admins can use this functionality
	 */
	async addAdmin(req, res) {
		try {
			const requestingUserRole = req.user?.role;
			const token = req.headers.authorization?.replace('Bearer ', '');

			// Check if requesting user is an admin
			if (requestingUserRole !== 'Admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Only admins can promote users to admin'
				});
			}

			const { email } = req.body;

			if (!email) {
				return res.status(400).json({
					success: false,
					message: 'Email is required'
				});
			}

			const result = await userService.addAdmin(email, token);

			res.status(200).json({
				success: true,
				message: `User with email ${email} has been promoted to Admin successfully`,
				data: result
			});
		} catch (error) {
			console.error('Error promoting user to admin:', error);
			const statusCode = error.message.includes('Forbidden') ? 403 : 
			                   error.message.includes('not found') ? 404 : 400;
			res.status(statusCode).json({
				success: false,
				message: error.message || 'Failed to promote user to admin'
			});
		}
	}
}

module.exports = new UserController();
