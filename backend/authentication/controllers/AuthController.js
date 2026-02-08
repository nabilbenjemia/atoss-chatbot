const authService = require('../services/AuthService');
const { validateTUMEmail, validatePassword } = require('../utils/validation');

/**
 * Auth Controller - handles HTTP requests for authentication operations
 */
class AuthController {
	// POST /auth/login
	async login(req, res) {
		try {
			const { email, password } = req.body;

			// Validate email format
			const emailValidation = validateTUMEmail(email);
			if (!emailValidation.valid) {
				return res.status(400).json({
					success: false,
					message: emailValidation.message
				});
			}

			if (!password) {
				return res.status(400).json({
					success: false,
					message: 'Password is required'
				});
			}

			const result = await authService.login(email, password);

			res.status(200).json({
				success: true,
				message: 'Login successful',
				data: result
			});
		} catch (error) {
			res.status(401).json({
				success: false,
				message: error.message || 'Authentication failed'
			});
		}
	}

	// POST /auth/logout
	async logout(req, res) {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized'
				});
			}

			await authService.logout(userId);

			res.status(200).json({
				success: true,
				message: 'Logout successful'
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: error.message || 'Logout failed'
			});
		}
	}

	// POST /auth/refresh
	async refreshToken(req, res) {
		try {
			const { refreshToken } = req.body;

			if (!refreshToken) {
				return res.status(400).json({
					success: false,
					message: 'Refresh token is required'
				});
			}

			const result = await authService.refreshAccessToken(refreshToken);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			res.status(401).json({
				success: false,
				message: error.message || 'Token refresh failed'
			});
		}
	}

	// POST /auth/register
	async register(req, res) {
		try {
			const { email, password, role, department } = req.body;

			// Validate email
			const emailValidation = validateTUMEmail(email);
			if (!emailValidation.valid) {
				return res.status(400).json({
					success: false,
					message: emailValidation.message
				});
			}

			// Validate password
			const passwordValidation = validatePassword(password);
			if (!passwordValidation.valid) {
				return res.status(400).json({
					success: false,
					message: passwordValidation.message
				});
			}

			if (!department) {
				return res.status(400).json({
					success: false,
					message: 'Department is required'
				});
			}

			const result = await authService.register({ email, password, role, department });

			res.status(201).json({
				success: true,
				message: 'Registration successful',
				data: result
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Registration failed'
			});
		}
	}

	// GET /auth/verify
	async verifyToken(req, res) {
		try {
			const token = req.headers.authorization?.replace('Bearer ', '');

			if (!token) {
				return res.status(401).json({
					success: false,
					message: 'Token is required'
				});
			}

			const decoded = authService.verifyToken(token);

			res.status(200).json({
				success: true,
				data: decoded
			});
		} catch (error) {
			res.status(401).json({
				success: false,
				message: error.message || 'Token verification failed'
			});
		}
	}

	// POST /auth/verify-email
	async verifyEmail(req, res) {
		try {
			const { token } = req.body;

			if (!token) {
				return res.status(400).json({
					success: false,
					message: 'Verification token is required'
				});
			}

			const result = await authService.verifyEmail(token);

			res.status(200).json({
				success: true,
				message: result.message || 'Email verified successfully'
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Email verification failed'
			});
		}
	}

	// POST /auth/resend-verification
	async resendVerificationEmail(req, res) {
		try {
			const { email } = req.body;

			// Validate email format
			const emailValidation = validateTUMEmail(email);
			if (!emailValidation.valid) {
				return res.status(400).json({
					success: false,
					message: emailValidation.message
				});
			}

			const result = await authService.resendVerificationEmail(email);

			res.status(200).json({
				success: true,
				message: result.message || 'Verification email sent successfully'
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to send verification email'
			});
		}
	}

	// GET /auth/user/:userId
	async getUserById(req, res) {
		try {
			const { userId } = req.params;
			const requestingUserId = req.user?.id;

			// Users can only view their own data
			if (requestingUserId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: You can only view your own profile'
				});
			}

			const user = await authService.getUserById(userId);

			res.status(200).json({
				success: true,
				data: user
			});
		} catch (error) {
			res.status(404).json({
				success: false,
				message: error.message || 'User not found'
			});
		}
	}

	// PATCH /auth/user/:userId/role
	// Allows admins to update any user's role, or users to update their own role
	async updateUserRole(req, res) {
		try {
			const { userId } = req.params;
			const { role } = req.body;
			const requestingUserId = req.user?.id;
			const requestingUserRole = req.user?.role;

			// Check if user is admin 
			if (requestingUserRole !== 'Admin' && requestingUserId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: You can only update your own role'
				});
			}

			if (!role) {
				return res.status(400).json({
					success: false,
					message: 'Role is required'
				});
			}

			const result = await authService.updateUserRole(userId, role);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			console.error('Error updating user role:', error);
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update role'
			});
		}
	}

	// GET /auth/user/email/:email
	async getUserByEmail(req, res) {
		try {
			const { email } = req.params;
			const requestingUserRole = req.user?.role;

			// Only admins can get user by email
			if (requestingUserRole !== 'Admin') {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: Only admins can access this endpoint'
				});
			}

			const user = await authService.getUserByEmail(email);

			res.status(200).json({
				success: true,
				data: user
			});
		} catch (error) {
			res.status(404).json({
				success: false,
				message: error.message || 'User not found'
			});
		}
	}

	// PATCH /auth/user/:userId/department
	async updateUserDepartment(req, res) {
		try {
			const { userId } = req.params;
			const { department } = req.body;
			const requestingUserId = req.user?.id;

			// Users can only update their own department
			if (requestingUserId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: You can only update your own department'
				});
			}

			if (!department) {
				return res.status(400).json({
					success: false,
					message: 'Department is required'
				});
			}

			const result = await authService.updateUserDepartment(userId, department);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			console.error('Error updating user department:', error);
			// Check if it's a Mongoose validation error
			if (error.name === 'ValidationError') {
				return res.status(400).json({
					success: false,
					message: `Validation error: ${error.message}. Department must be one of: Department 1, Department 2, Department 3`
				});
			}
			res.status(400).json({
				success: false,
				message: error.message || 'Failed to update department'
			});
		}
	}

	// PATCH /auth/user/:userId/password
	async updateUserPassword(req, res) {
		try {
			const { userId } = req.params;
			const { currentPassword, newPassword } = req.body;
			const requestingUserId = req.user?.id;

			// Users can only update their own password
			if (requestingUserId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: You can only update your own password'
				});
			}

			if (!currentPassword || !newPassword) {
				return res.status(400).json({
					success: false,
					message: 'Current password and new password are required'
				});
			}

			const result = await authService.updateUserPassword(userId, currentPassword, newPassword);

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

	// DELETE /auth/user/:userId
	async deleteUser(req, res) {
		try {
			const { userId } = req.params;
			const requestingUserId = req.user?.id;

			// Users can only delete their own account
			if (requestingUserId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Forbidden: You can only delete your own account'
				});
			}

			await authService.deleteUser(userId);

			res.status(200).json({
				success: true,
				message: 'User deleted successfully'
			});
		} catch (error) {
			res.status(404).json({
				success: false,
				message: error.message || 'Failed to delete user'
			});
		}
	}
}

module.exports = new AuthController();

