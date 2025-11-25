const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserCredentials = require('../models/UserCredentials');
const axios = require('axios');

/**
 * AuthService
 * Core business logic for authentication
 * Based on UML diagram - handles login, logout, and user verification
 */
class AuthService {
	constructor() {
		this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
		this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
		this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key-change-in-production';
		this.userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4001';
	}

	/**
	 * Login method
	 * Authenticates user credentials and generates JWT token
	 * @param {string} email - User email
	 * @param {string} password - User password
	 * @returns {Promise<Object>} - Token and user information
	 */
	async login(email, password) {
		try {
			// Find user credentials
			const userCredentials = await UserCredentials.findOne({ email: email.toLowerCase() });
			
			if (!userCredentials) {
				throw new Error('Invalid email or password');
			}

			// Verify user existence with User Service
			await this.verifyUserExistence(userCredentials.id);

			// Verify password
			const isPasswordValid = await bcrypt.compare(password, userCredentials.passwordHash);
			
			if (!isPasswordValid) {
				throw new Error('Invalid email or password');
			}

			// Generate JWT token
			const token = this.generateToken(userCredentials);
			const refreshToken = this.generateRefreshToken(userCredentials);

			// Update user credentials with token and last login
			userCredentials.token = token;
			userCredentials.refreshToken = refreshToken;
			userCredentials.lastLogin = new Date();
			await userCredentials.save();

			return {
				token,
				refreshToken,
				user: {
					id: userCredentials.id,
					email: userCredentials.email,
					role: userCredentials.role,
					department: userCredentials.department
				}
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Logout method
	 * Invalidates user token
	 * @param {string} userId - User ID
	 * @returns {Promise<boolean>}
	 */
	async logout(userId) {
		try {
			const userCredentials = await UserCredentials.findOne({ id: userId });
			
			if (userCredentials) {
				userCredentials.token = null;
				userCredentials.refreshToken = null;
				await userCredentials.save();
			}
			
			return true;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Verify user existence with User Service
	 * @param {string} userId - User ID
	 * @returns {Promise<boolean>}
	 */
	async verifyUserExistence(userId) {
		try {
			const response = await axios.get(`${this.userServiceUrl}/users/${userId}/verify`, {
				timeout: 5000
			});
			
			return response.data.exists === true;
		} catch (error) {
			// If User Service is not available, log warning but allow authentication to proceed
			// This is a fallback mechanism - in production you might want stricter handling
			console.warn(`User Service verification failed for user ${userId}:`, error.message);
			return true; // Allow authentication to proceed
		}
	}

	/**
	 * Generate JWT token
	 * @param {Object} userCredentials - User credentials object
	 * @returns {string} - JWT token
	 */
	generateToken(userCredentials) {
		const payload = {
			id: userCredentials.id,
			email: userCredentials.email,
			role: userCredentials.role,
			department: userCredentials.department
		};

		return jwt.sign(payload, this.jwtSecret, {
			expiresIn: this.jwtExpiration
		});
	}

	/**
	 * Generate refresh token
	 * @param {Object} userCredentials - User credentials object
	 * @returns {string} - Refresh token
	 */
	generateRefreshToken(userCredentials) {
		const payload = {
			id: userCredentials.id,
			type: 'refresh'
		};

		return jwt.sign(payload, this.refreshTokenSecret, {
			expiresIn: '7d'
		});
	}

	/**
	 * Verify JWT token
	 * @param {string} token - JWT token
	 * @returns {Object} - Decoded token payload
	 */
	verifyToken(token) {
		try {
			return jwt.verify(token, this.jwtSecret);
		} catch (error) {
			throw new Error('Invalid or expired token');
		}
	}

	/**
	 * Refresh access token using refresh token
	 * @param {string} refreshToken - Refresh token
	 * @returns {Promise<Object>} - New access token
	 */
	async refreshAccessToken(refreshToken) {
		try {
			const decoded = jwt.verify(refreshToken, this.refreshTokenSecret);
			
			const userCredentials = await UserCredentials.findOne({ id: decoded.id });
			
			if (!userCredentials || userCredentials.refreshToken !== refreshToken) {
				throw new Error('Invalid refresh token');
			}

			const newToken = this.generateToken(userCredentials);
			userCredentials.token = newToken;
			await userCredentials.save();

			return {
				token: newToken
			};
		} catch (error) {
			throw new Error('Invalid or expired refresh token');
		}
	}

	/**
	 * Register new user credentials
	 * @param {Object} userData - User registration data
	 * @returns {Promise<Object>} - Created user credentials
	 */
	async register(userData) {
		try {
			const { email, password, role, department } = userData;

			// Check if user already exists
			const existingUser = await UserCredentials.findOne({ email: email.toLowerCase() });
			if (existingUser) {
				throw new Error('User with this email already exists');
			}

			// Hash password
			const saltRounds = 10;
			const passwordHash = await bcrypt.hash(password, saltRounds);

			// Create user credentials
			const userCredentials = new UserCredentials({
				email: email.toLowerCase(),
				passwordHash,
				role: role || 'Staff',
				department
			});

			await userCredentials.save();

			return {
				id: userCredentials.id,
				email: userCredentials.email,
				role: userCredentials.role,
				department: userCredentials.department
			};
		} catch (error) {
			throw error;
		}
	}
}

module.exports = new AuthService();

