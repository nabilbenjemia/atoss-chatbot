const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserCredentials = require('../models/UserCredentials');
const axios = require('axios');
const emailService = require('./EmailService');

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

			// Check if email is verified
			if (!userCredentials.emailVerified) {
				throw new Error('Please verify your email address before logging in. Check your inbox for the verification email.');
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

			// Generate email verification token
			const verificationToken = emailService.generateVerificationToken();
			const verificationTokenExpires = new Date();
			verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours expiry

			// Create user credentials
			const userCredentials = new UserCredentials({
				email: email.toLowerCase(),
				passwordHash,
				role: role || 'Staff',
				department,
				emailVerified: false,
				emailVerificationToken: verificationToken,
				emailVerificationTokenExpires: verificationTokenExpires
			});

			await userCredentials.save();

			// Send verification email
			try {
				await emailService.sendVerificationEmail(email, verificationToken);
			} catch (emailError) {
				console.error('Failed to send verification email:', emailError);
				// Don't fail registration if email fails, but log it
			}

			return {
				id: userCredentials.id,
				email: userCredentials.email,
				role: userCredentials.role,
				department: userCredentials.department,
				emailVerified: false,
				message: 'Registration successful. Please check your email to verify your account.'
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Verify email address using verification token
	 * @param {string} token - Email verification token
	 * @returns {Promise<Object>}
	 */
	async verifyEmail(token) {
		try {
			if (!token || token.trim() === '') {
				throw new Error('Verification token is required');
			}

			// Clean the token
			const trimmedToken = token.trim();

			// Try to decode the token (in case it was URL-encoded)
			let decodedToken = trimmedToken;
			try {
				decodedToken = decodeURIComponent(trimmedToken);
			} catch (e) {
				// If decoding fails, token is already decoded or invalid encoding - use as-is
				decodedToken = trimmedToken;
			}

			// First, try to find user by the decoded token
			let userCredentials = await UserCredentials.findOne({
				emailVerificationToken: decodedToken
			});

			// If not found, try the original trimmed token (in case it wasn't encoded)
			if (!userCredentials && decodedToken !== trimmedToken) {
				userCredentials = await UserCredentials.findOne({
					emailVerificationToken: trimmedToken
				});
			}

			// If still not found by token, the token is invalid, expired, or already used
			if (!userCredentials) {
				throw new Error('Invalid or expired verification token. The link may have already been used or expired. Please request a new verification email.');
			}

			// Check if token has expired
			if (userCredentials.emailVerificationTokenExpires && userCredentials.emailVerificationTokenExpires < new Date()) {
				// Clear expired token
				userCredentials.emailVerificationToken = null;
				userCredentials.emailVerificationTokenExpires = null;
				await userCredentials.save();
				throw new Error('Verification token has expired. Please request a new verification email.');
			}

			// Check if already verified
			if (userCredentials.emailVerified) {
				// Clear the token since it's already been used
				userCredentials.emailVerificationToken = null;
				userCredentials.emailVerificationTokenExpires = null;
				await userCredentials.save();
				return {
					success: true,
					message: 'Email already verified. You can now log in.'
				};
			}

			// Mark email as verified
			userCredentials.emailVerified = true;
			userCredentials.emailVerificationToken = null;
			userCredentials.emailVerificationTokenExpires = null;
			await userCredentials.save();

			return {
				success: true,
				message: 'Email verified successfully'
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Resend verification email
	 * @param {string} email - User email
	 * @returns {Promise<Object>}
	 */
	async resendVerificationEmail(email) {
		try {
			const userCredentials = await UserCredentials.findOne({ email: email.toLowerCase() });

			if (!userCredentials) {
				throw new Error('User not found');
			}

			if (userCredentials.emailVerified) {
				return {
					success: true,
					message: 'Email already verified'
				};
			}

			// Generate new verification token
			const verificationToken = emailService.generateVerificationToken();
			const verificationTokenExpires = new Date();
			verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24);

			userCredentials.emailVerificationToken = verificationToken;
			userCredentials.emailVerificationTokenExpires = verificationTokenExpires;
			await userCredentials.save();

			// Send verification email
			await emailService.sendVerificationEmail(email, verificationToken);

			return {
				success: true,
				message: 'Verification email sent successfully'
			};
		} catch (error) {
			throw error;
		}
	}
}

module.exports = new AuthService();

