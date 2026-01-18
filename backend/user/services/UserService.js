const axios = require('axios');
const UserProfile = require('../models/UserProfile');
const bcrypt = require('bcryptjs');
const Role = require('../../authentication/models/Role');
const Department = require('../../authentication/models/Department');

/**
 * UserService
 * Core business logic for user management
 * Coordinates with Authentication Service for credential updates
 */
class UserService {
	constructor() {
		this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
	}

	/**
	 * Get user profile by userId
	 * @param {string} userId - User ID
	 * @param {string} token - Optional auth token
	 * @returns {Promise<Object>} - User profile with credentials info
	 */
	async getUserProfile(userId, token = null) {
		try {
			// Get profile from UserProfile collection
			let userProfile = await UserProfile.findOne({ userId });
			
			// If profile doesn't exist, create a default one
			if (!userProfile) {
				userProfile = new UserProfile({ userId });
				await userProfile.save();
			}

			// Get credentials info from auth service
			const credentialsInfo = await this.getUserCredentials(userId, token);

			return {
				userId: userProfile.userId,
				username: userProfile.username,
				profilePicture: userProfile.profilePicture,
				email: credentialsInfo.email,
				role: credentialsInfo.role,
				department: credentialsInfo.department,
				emailVerified: credentialsInfo.emailVerified,
				lastLogin: credentialsInfo.lastLogin,
				preferences: userProfile.preferences,
				createdAt: credentialsInfo.createdAt,
				updatedAt: userProfile.updatedAt
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get user credentials from auth service
	 * @param {string} userId - User ID
	 * @param {string} token - Optional auth token
	 * @returns {Promise<Object>} - User credentials
	 */
	async getUserCredentials(userId, token = null) {
		try {
			const headers = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			} else if (process.env.INTERNAL_SERVICE_TOKEN) {
				headers['Authorization'] = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`;
			}

			const response = await axios.get(`${this.authServiceUrl}/auth/user/${userId}`, {
				timeout: 5000,
				headers
			});
			return response.data.data;
		} catch (error) {
			// If auth service endpoint doesn't exist, we'll handle it gracefully
			if (error.response && error.response.status === 404) {
				throw new Error('User credentials not found');
			}
			throw new Error('Failed to fetch user credentials from auth service');
		}
	}

	/**
	 * Update username (display name)
	 * @param {string} userId - User ID
	 * @param {string} username - New username
	 * @returns {Promise<Object>} - Updated profile
	 */
	async updateUsername(userId, username) {
		try {
			if (username && username.trim().length > 50) {
				throw new Error('Username must be 50 characters or less');
			}

			let userProfile = await UserProfile.findOne({ userId });
			
			if (!userProfile) {
				userProfile = new UserProfile({ userId });
			}

			userProfile.username = username ? username.trim() : null;
			await userProfile.save();

			return {
				userId: userProfile.userId,
				username: userProfile.username,
				updatedAt: userProfile.updatedAt
			};
		} catch (error) {
			console.error('UserService.updateUsername error:', error);
			throw error;
		}
	}

	/**
	 * Update user role
	 * @param {string} userId - User ID
	 * @param {string} role - New role (Admin or Staff)
	 * @param {string} token - Optional auth token
	 * @returns {Promise<Object>} - Updated credentials
	 */
	async updateRole(userId, role, token = null) {
		try {
			if (!role || ![Role.ADMIN, Role.STAFF].includes(role)) {
				throw new Error('Invalid role. Must be Admin or Staff');
			}

			const headers = { 'Content-Type': 'application/json' };
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			} else if (process.env.INTERNAL_SERVICE_TOKEN) {
				headers['Authorization'] = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`;
			}

			const response = await axios.patch(
				`${this.authServiceUrl}/auth/user/${userId}/role`,
				{ role },
				{
					timeout: 5000,
					headers
				}
			);

			return response.data.data;
		} catch (error) {
			console.error('UserService.updateRole error:', error.response?.data || error.message);
			if (error.response && error.response.status === 404) {
				throw new Error('User not found');
			}
			throw new Error(error.response?.data?.message || 'Failed to update role');
		}
	}

	/**
	 * Update user department
	 * @param {string} userId - User ID
	 * @param {string} department - New department
	 * @param {string} token - Optional auth token
	 * @returns {Promise<Object>} - Updated credentials
	 */
	async updateDepartment(userId, department, token = null) {
		try {
			if (!department || typeof department !== 'string' || department.trim() === '') {
				throw new Error('Department is required and must be a non-empty string');
			}

			const headers = { 'Content-Type': 'application/json' };
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			} else if (process.env.INTERNAL_SERVICE_TOKEN) {
				headers['Authorization'] = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`;
			}

			const response = await axios.patch(
				`${this.authServiceUrl}/auth/user/${userId}/department`,
				{ department },
				{
					timeout: 5000,
					headers
				}
			);

			return response.data.data;
		} catch (error) {
			console.error('UserService.updateDepartment error:', error.response?.data || error.message);
			if (error.response && error.response.status === 404) {
				throw new Error('User not found');
			}
			throw new Error(error.response?.data?.message || 'Failed to update department');
		}
	}

	/**
	 * Update user password
	 * @param {string} userId - User ID
	 * @param {string} currentPassword - Current password
	 * @param {string} newPassword - New password
	 * @param {string} token - Optional auth token
	 * @returns {Promise<Object>} - Success message
	 */
	async updatePassword(userId, currentPassword, newPassword, token = null) {
		try {
			if (!currentPassword || !newPassword) {
				throw new Error('Current password and new password are required');
			}

			const headers = { 'Content-Type': 'application/json' };
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			} else if (process.env.INTERNAL_SERVICE_TOKEN) {
				headers['Authorization'] = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`;
			}

			const response = await axios.patch(
				`${this.authServiceUrl}/auth/user/${userId}/password`,
				{ currentPassword, newPassword },
				{
					timeout: 5000,
					headers
				}
			);

			return response.data;
		} catch (error) {
			if (error.response && error.response.status === 401) {
				throw new Error('Current password is incorrect');
			}
			if (error.response && error.response.status === 404) {
				throw new Error('User not found');
			}
			throw new Error(error.response?.data?.message || 'Failed to update password');
		}
	}

	/**
	 * Update user preferences
	 * @param {string} userId - User ID
	 * @param {Object} preferences - Preferences to update
	 * @returns {Promise<Object>} - Updated profile
	 */
	async updatePreferences(userId, preferences) {
		try {
			let userProfile = await UserProfile.findOne({ userId });
			
			if (!userProfile) {
				userProfile = new UserProfile({ userId });
			}

			if (preferences.theme) {
				if (!['light', 'dark', 'auto'].includes(preferences.theme)) {
					throw new Error('Invalid theme. Must be light, dark, or auto');
				}
				userProfile.preferences.theme = preferences.theme;
			}

			if (preferences.language) {
				userProfile.preferences.language = preferences.language;
			}

			if (preferences.notifications) {
				if (typeof preferences.notifications.email === 'boolean') {
					userProfile.preferences.notifications.email = preferences.notifications.email;
				}
				if (typeof preferences.notifications.chat === 'boolean') {
					userProfile.preferences.notifications.chat = preferences.notifications.chat;
				}
			}

			await userProfile.save();

			return {
				userId: userProfile.userId,
				preferences: userProfile.preferences,
				updatedAt: userProfile.updatedAt
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Delete user account
	 * @param {string} userId - User ID
	 * @param {string} token - Optional auth token
	 * @returns {Promise<boolean>} - Success status
	 */
	async deleteAccount(userId, token = null) {
		try {
			// Delete profile from UserProfile collection
			await UserProfile.deleteOne({ userId });

			// Delete credentials from auth service
			const headers = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			} else if (process.env.INTERNAL_SERVICE_TOKEN) {
				headers['Authorization'] = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`;
			}

			try {
				await axios.delete(
					`${this.authServiceUrl}/auth/user/${userId}`,
					{
						timeout: 5000,
						headers
					}
				);
			} catch (error) {
				// If auth service returned 404, user was already deleted
				if (error.response && error.response.status !== 404) {
					console.error('Error deleting user credentials:', error.message);
				}
			}

			return true;
		} catch (error) {
			// Ensure profile is deleted even if auth service fails
			await UserProfile.deleteOne({ userId });
			throw new Error('Failed to fully delete user account');
		}
	}

	/**
	 * Update user profile picture
	 * @param {string} userId - User ID
	 * @param {string} profilePicture - Base64 encoded image data (data:image/png;base64,...)
	 * @returns {Promise<Object>} - Updated profile
	 */
	async updateProfilePicture(userId, profilePicture) {
		try {
			// Validate base64 image format
			if (profilePicture && !profilePicture.startsWith('data:image/')) {
				throw new Error('Invalid image format. Must be base64 encoded image (data:image/...)');
			}

			// Limit image size (e.g., 2MB = ~2.6MB in base64)
			if (profilePicture && profilePicture.length > 2800000) {
				throw new Error('Image size too large. Maximum size is 2MB');
			}

			let userProfile = await UserProfile.findOne({ userId });
			
			if (!userProfile) {
				userProfile = new UserProfile({ userId });
			}

			userProfile.profilePicture = profilePicture || null;
			await userProfile.save();

			return {
				userId: userProfile.userId,
				profilePicture: userProfile.profilePicture,
				updatedAt: userProfile.updatedAt
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Delete user profile picture
	 * @param {string} userId - User ID
	 * @returns {Promise<Object>} - Updated profile
	 */
	async deleteProfilePicture(userId) {
		try {
			let userProfile = await UserProfile.findOne({ userId });
			
			if (!userProfile) {
				userProfile = new UserProfile({ userId });
			}

			userProfile.profilePicture = null;
			await userProfile.save();

			return {
				userId: userProfile.userId,
				profilePicture: null,
				updatedAt: userProfile.updatedAt
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Verify user exists (for auth service)
	 * @param {string} userId - User ID
	 * @returns {Promise<boolean>} - Whether user exists
	 */
	async verifyUserExists(userId) {
		try {
			const profile = await UserProfile.findOne({ userId });
			// Note: We don't check auth service here as this is called by auth service
			return !!profile;
		} catch (error) {
			return false;
		}
	}
}

module.exports = new UserService();
