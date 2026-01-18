const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * User routes
 * Note: Routes are mounted at /users in the gateway, so these become:
 * /users/me, /users/:userId/verify, etc.
 */

// Verify user exists (for auth service) - must be before /me routes
router.get('/:userId/verify', userController.verifyUser.bind(userController));

// Get current user profile
router.get('/me', authMiddleware, userController.getProfile.bind(userController));

// Update username
router.patch('/me/username', authMiddleware, userController.updateUsername.bind(userController));

// Update role
router.patch('/me/role', authMiddleware, userController.updateRole.bind(userController));

// Update department
router.patch('/me/department', authMiddleware, userController.updateDepartment.bind(userController));

// Update password
router.patch('/me/password', authMiddleware, userController.updatePassword.bind(userController));

// Update preferences
router.patch('/me/preferences', authMiddleware, userController.updatePreferences.bind(userController));

// Update profile picture
router.patch('/me/profile-picture', authMiddleware, userController.updateProfilePicture.bind(userController));

// Delete profile picture
router.delete('/me/profile-picture', authMiddleware, userController.deleteProfilePicture.bind(userController));

// Delete account
router.delete('/me', authMiddleware, userController.deleteAccount.bind(userController));

module.exports = router;
