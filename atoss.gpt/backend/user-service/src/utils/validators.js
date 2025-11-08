/**
 * Validators for input validation
 */

import { VALIDATION, ROLES, DEPARTMENTS } from './constants.js';

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email must be a non-empty string' };
  }

  if (email.length > VALIDATION.EMAIL_MAX_LENGTH) {
    return { valid: false, error: `Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters` };
  }

  if (!VALIDATION.EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Email format is invalid' };
  }

  return { valid: true };
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password must be a non-empty string' };
  }

  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters` };
  }

  return { valid: true };
};

const validateName = (name, fieldName = 'Name') => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${fieldName} must be a non-empty string` };
  }

  const trimmed = name.trim();
  if (trimmed.length < VALIDATION.NAME_MIN_LENGTH) {
    return { valid: false, error: `${fieldName} must be at least ${VALIDATION.NAME_MIN_LENGTH} characters` };
  }

  if (trimmed.length > VALIDATION.NAME_MAX_LENGTH) {
    return { valid: false, error: `${fieldName} must not exceed ${VALIDATION.NAME_MAX_LENGTH} characters` };
  }

  return { valid: true };
};

const validateRole = (role) => {
  const validRoles = Object.values(ROLES);
  if (!role || !validRoles.includes(role)) {
    return { valid: false, error: `Role must be one of: ${validRoles.join(', ')}` };
  }

  return { valid: true };
};

const validateDepartment = (department) => {
  const validDepartments = Object.values(DEPARTMENTS);
  if (!department || !validDepartments.includes(department)) {
    return { valid: false, error: `Department must be one of: ${validDepartments.join(', ')}` };
  }

  return { valid: true };
};

const validateCreateUserInput = (input) => {
  const errors = [];

  if (!input) {
    return { valid: false, errors: ['Input data required'] };
  }

  const emailValidation = validateEmail(input.email);
  if (!emailValidation.valid) {
    errors.push(emailValidation.error);
  }

  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    errors.push(passwordValidation.error);
  }

  const roleValidation = validateRole(input.role);
  if (!roleValidation.valid) {
    errors.push(roleValidation.error);
  }

  const departmentValidation = validateDepartment(input.department);
  if (!departmentValidation.valid) {
    errors.push(departmentValidation.error);
  }

  const firstNameValidation = validateName(input.firstName, 'First Name');
  if (!firstNameValidation.valid) {
    errors.push(firstNameValidation.error);
  }

  const lastNameValidation = validateName(input.lastName, 'Last Name');
  if (!lastNameValidation.valid) {
    errors.push(lastNameValidation.error);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
};

const validateUpdateUserInput = (input) => {
  const errors = [];

  if (!input) {
    return { valid: true, errors: [] }; // Empty update is valid
  }

  if (input.email !== undefined) {
    const emailValidation = validateEmail(input.email);
    if (!emailValidation.valid) {
      errors.push(emailValidation.error);
    }
  }

  if (input.role !== undefined) {
    const roleValidation = validateRole(input.role);
    if (!roleValidation.valid) {
      errors.push(roleValidation.error);
    }
  }

  if (input.department !== undefined) {
    const departmentValidation = validateDepartment(input.department);
    if (!departmentValidation.valid) {
      errors.push(departmentValidation.error);
    }
  }

  if (input.firstName !== undefined) {
    const firstNameValidation = validateName(input.firstName, 'First Name');
    if (!firstNameValidation.valid) {
      errors.push(firstNameValidation.error);
    }
  }

  if (input.lastName !== undefined) {
    const lastNameValidation = validateName(input.lastName, 'Last Name');
    if (!lastNameValidation.valid) {
      errors.push(lastNameValidation.error);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
};

export {
  validateEmail,
  validatePassword,
  validateName,
  validateRole,
  validateDepartment,
  validateCreateUserInput,
  validateUpdateUserInput,
};
