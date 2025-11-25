const authService = require('../services/AuthService');

/**
 * API Gateway middleware
 * Handles authentication for protected routes
 * Allows public routes to pass through without authentication
 */
const gatewayAuthMiddleware = (publicRoutes = []) => {
	return async (req, res, next) => {
		// Check if route is public
		const isPublicRoute = publicRoutes.some(route => {
			if (typeof route === 'string') {
				return req.path.startsWith(route);
			}
			if (route instanceof RegExp) {
				return route.test(req.path);
			}
			return false;
		});

		// Skip authentication for public routes
		if (isPublicRoute) {
			return next();
		}

		// Require authentication for protected routes
		try {
			const authHeader = req.headers.authorization;

			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return res.status(401).json({
					success: false,
					message: 'Authentication required'
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
};

module.exports = gatewayAuthMiddleware;

