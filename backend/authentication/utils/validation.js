/**
 * Backend validation utilities
 */

/**
 * Validates TUM email format
 * @param {string} email - Email address to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateTUMEmail = (email) => {
	if (!email || typeof email !== 'string' || email.trim() === '') {
		return { valid: false, message: 'Email is required' };
	}

	const trimmedEmail = email.trim().toLowerCase();

	// Basic email format check
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmedEmail)) {
		return { valid: false, message: 'Invalid email format' };
	}

	// Check for TUM domain
	const tumDomains = ['@tum.de', '@mytum.de'];
	const hasTUMDomain = tumDomains.some(domain => trimmedEmail.endsWith(domain));
	
	if (!hasTUMDomain) {
		return { valid: false, message: 'Email must be a TUM email address (@tum.de or @mytum.de)' };
	}

	// Validate local part (username before @)
	const localPart = trimmedEmail.split('@')[0];
	
	if (!localPart || localPart.length < 2) {
		return { valid: false, message: 'Email username must be at least 2 characters long' };
	}

	// Check for valid characters in local part
	const localPartRegex = /^[a-zA-Z0-9._-]+$/;
	if (!localPartRegex.test(localPart)) {
		return { valid: false, message: 'Email contains invalid characters' };
	}

	return { valid: true, message: '' };
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validatePassword = (password) => {
	if (!password || typeof password !== 'string' || password.trim() === '') {
		return { valid: false, message: 'Password is required' };
	}

	// Minimum length
	if (password.length < 8) {
		return { valid: false, message: 'Password must be at least 8 characters long' };
	}

	// Check for at least one letter
	if (!/[a-zA-Z]/.test(password)) {
		return { valid: false, message: 'Password must contain at least one letter' };
	}

	// Check for at least one number
	if (!/[0-9]/.test(password)) {
		return { valid: false, message: 'Password must contain at least one number' };
	}

	return { valid: true, message: '' };
};

module.exports = {
	validateTUMEmail,
	validatePassword
};

