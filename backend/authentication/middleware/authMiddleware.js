const authService = require('../services/AuthService');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user information to request
 */
const authMiddleware = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				success: false,
				message: 'No token provided'
			});
		}

		const token = authHeader.replace('Bearer ', '');
		const decoded = authService.verifyToken(token);

		// Attach user information to request
		req.user = decoded;
		next();
	} catch (error) {
		res.status(401).json({
			success: false,
			message: error.message || 'Invalid or expired token'
		});
	}
};

module.exports = authMiddleware;

