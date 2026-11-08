const jwt = require('jsonwebtoken');

/**
 * Authentication middleware for User Service
 * Verifies JWT token and attaches user information to request
 * Uses the same JWT_SECRET as the authentication service
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
		
		// Use the same JWT_SECRET as authentication service
		const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
		
		const decoded = jwt.verify(token, jwtSecret);

		// Attach user information to request
		req.user = decoded;
		next();
	} catch (error) {
		// Handle JWT verification errors
		if (error.name === 'JsonWebTokenError') {
			return res.status(401).json({
				success: false,
				message: 'Invalid token'
			});
		}
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				success: false,
				message: 'Token expired'
			});
		}
		return res.status(401).json({
			success: false,
			message: error.message || 'Invalid or expired token'
		});
	}
};

module.exports = authMiddleware;
