/**
 * Validation utilities for form inputs
 */

/**
 * Validates TUM email format
 * Examples: tim.becker@tum.de, max.mustermann@tum.de, user@mytum.de
 * @param {string} email - Email address to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
export const validateTUMEmail = (email) => {
  if (!email || email.trim() === '') {
    return { valid: false, message: 'Email is required.' };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Check for TUM domain
  const tumDomains = ['@tum.de', '@mytum.de'];
  const hasTUMDomain = tumDomains.some(domain => email.toLowerCase().endsWith(domain));
  
  if (!hasTUMDomain) {
    return { valid: false, message: 'Please use your TUM email address (@tum.de or @mytum.de).' };
  }

  // Validate TUM email format: should have a local part before @
  // Examples: tim.becker@tum.de, max.mustermann@tum.de
  const localPart = email.split('@')[0];
  
  if (!localPart || localPart.length === 0) {
    return { valid: false, message: 'Email must have a valid username before @tum.de or @mytum.de.' };
  }

  // Check for valid characters in local part (letters, numbers, dots, hyphens, underscores)
  const localPartRegex = /^[a-zA-Z0-9._-]+$/;
  if (!localPartRegex.test(localPart)) {
    return { valid: false, message: 'Email contains invalid characters. Use letters, numbers, dots, hyphens, or underscores.' };
  }

  // Check minimum length for local part
  if (localPart.length < 2) {
    return { valid: false, message: 'Email username must be at least 2 characters long.' };
  }

  return { valid: true, message: '' };
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, message: string, strength: string }
 */
export const validatePassword = (password) => {
  if (!password || password.trim() === '') {
    return { valid: false, message: 'Password is required.', strength: 'weak' };
  }

  // Minimum length
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.', strength: 'weak' };
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter.', strength: 'weak' };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.', strength: 'weak' };
  }

  // Check password strength
  let strength = 'weak';
  let strengthMessage = '';

  // Strong password: 12+ chars, has uppercase, lowercase, number, special char
  if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
    strength = 'strong';
    strengthMessage = 'Strong password';
  }
  // Medium password: 8+ chars, has uppercase or lowercase, number
  else if (password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)) {
    strength = 'medium';
    strengthMessage = 'Medium strength password';
  }

  return { valid: true, message: strengthMessage, strength };
};

/**
 * Validates password confirmation
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {Object} - { valid: boolean, message: string }
 */
export const validatePasswordConfirmation = (password, confirmPassword) => {
  if (!confirmPassword || confirmPassword.trim() === '') {
    return { valid: false, message: 'Please confirm your password.' };
  }

  if (password !== confirmPassword) {
    return { valid: false, message: 'Passwords do not match.' };
  }

  return { valid: true, message: '' };
};

