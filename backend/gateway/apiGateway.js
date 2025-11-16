const express = require('express');
const proxy = require('express-http-proxy');
const authRoutes = require('../routes/authRoutes');
const gatewayAuthMiddleware = require('../middleware/gatewayMiddleware');

/**
 * API Gateway
 * Routes requests to appropriate microservices based on path
 * Based on UML diagram routing rules:
 * - /auth/* -> Auth Service (local)
 * - /users/* -> User Service
 * - /chat/* -> Chatbot Service
 * - /learning/* -> Learning Service
 */
const createApiGateway = (app) => {
	// Public routes that don't require authentication
	const publicRoutes = [
		'/auth/login',
		'/auth/register',
		'/auth/refresh',
		'/auth/verify',
		'/auth/verify-email',
		'/auth/resend-verification',
		'/api/health'
	];

	// Auth Service routes (local - handled by this service)
	// These routes handle their own authentication logic
	app.use('/auth', authRoutes);

	// Apply gateway authentication middleware for proxied routes
	// This middleware will protect /users/*, /chat/*, /learning/* routes
	app.use(gatewayAuthMiddleware(publicRoutes));

	// User Service proxy
	// Routes: /users/* -> User Service
	const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4001';
	app.use('/users', proxy(userServiceUrl, {
		proxyReqPathResolver: (req) => {
			return req.url;
		},
		proxyErrorHandler: (err, res, next) => {
			console.error('User Service proxy error:', err);
			res.status(502).json({
				success: false,
				message: 'User Service is currently unavailable'
			});
		}
	}));

	// Chatbot Service proxy
	// Routes: /chat/* -> Chatbot Service
	const chatbotServiceUrl = process.env.CHATBOT_SERVICE_URL || 'http://localhost:4002';
	app.use('/chat', proxy(chatbotServiceUrl, {
		proxyReqPathResolver: (req) => {
			return req.url;
		},
		proxyErrorHandler: (err, res, next) => {
			console.error('Chatbot Service proxy error:', err);
			res.status(502).json({
				success: false,
				message: 'Chatbot Service is currently unavailable'
			});
		}
	}));

	// Learning Service proxy
	// Routes: /learning/* -> Learning Service
	const learningServiceUrl = process.env.LEARNING_SERVICE_URL || 'http://localhost:4003';
	app.use('/learning', proxy(learningServiceUrl, {
		proxyReqPathResolver: (req) => {
			return req.url;
		},
		proxyErrorHandler: (err, res, next) => {
			console.error('Learning Service proxy error:', err);
			res.status(502).json({
				success: false,
				message: 'Learning Service is currently unavailable'
			});
		}
	}));

	// Health check endpoint
	app.get('/api/health', (_req, res) => {
		res.json({
			status: 'ok',
			service: 'API Gateway',
			timestamp: new Date().toISOString()
		});
	});

	// 404 handler for unmatched routes
	app.use((req, res) => {
		res.status(404).json({
			success: false,
			message: 'Route not found'
		});
	});
};

module.exports = createApiGateway;

