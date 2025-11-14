const authService = require('../services/AuthService');

/**
 * AuthController
 * Entry point for authentication HTTP requests
 * Based on UML diagram - handles incoming requests related to authentication
 */
class AuthController {
	/**
	 * Handle login request
	 * POST /auth/login
	 */
	async login(req, res) {
		try {
			const { email, password } = req.body;

			if (!email || !password) {
				return res.status(400).json({
					success: false,
					message: 'Email and password are required'
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

	/**
	 * Handle logout request
	 * POST /auth/logout
	 */
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

	/**
	 * Handle refresh token request
	 * POST /auth/refresh
	 */
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

	/**
	 * Handle registration request
	 * POST /auth/register
	 */
	async register(req, res) {
		try {
			const { email, password, role, department } = req.body;

			if (!email || !password || !department) {
				return res.status(400).json({
					success: false,
					message: 'Email, password, and department are required'
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

	/**
	 * Handle verify token request
	 * GET /auth/verify
	 */
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

	/**
	 * Handle email verification request
	 * POST /auth/verify-email
	 */
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

	/**
	 * Handle resend verification email request
	 * POST /auth/resend-verification
	 */
	async resendVerificationEmail(req, res) {
		try {
			const { email } = req.body;

			if (!email) {
				return res.status(400).json({
					success: false,
					message: 'Email is required'
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
}

module.exports = new AuthController();

