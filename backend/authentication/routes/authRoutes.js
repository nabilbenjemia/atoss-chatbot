const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Authentication Routes - handles user authentication and account management
 */

// Public routes
router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.get('/verify', authController.verifyToken.bind(authController));
router.post('/verify-email', authController.verifyEmail.bind(authController));
router.post('/resend-verification', authController.resendVerificationEmail.bind(authController));

// Protected routes (require authentication)
router.post('/logout', authMiddleware, authController.logout.bind(authController));

// User management routes (require authentication and user must match userId or be admin)
router.get('/user/:userId', authMiddleware, authController.getUserById.bind(authController));
router.get('/user/email/:email', authMiddleware, authController.getUserByEmail.bind(authController));
router.patch('/user/:userId/role', authMiddleware, authController.updateUserRole.bind(authController));
router.patch('/user/:userId/department', authMiddleware, authController.updateUserDepartment.bind(authController));
router.patch('/user/:userId/password', authMiddleware, authController.updateUserPassword.bind(authController));
router.delete('/user/:userId', authMiddleware, authController.deleteUser.bind(authController));

module.exports = router;

