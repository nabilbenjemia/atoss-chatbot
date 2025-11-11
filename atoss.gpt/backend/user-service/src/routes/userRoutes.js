import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateCreateUserRequest } from '../middleware/validationMiddleware.js';
import UserController from '../controllers/UserController.js';

const router = express.Router();

// POST /users - create user (requires auth, both Admin/Staff allowed for MVP)
router.post('/', authMiddleware, validateCreateUserRequest, UserController.create);

// GET /users/:userId - get user by UUID (requires auth)
router.get('/:userId', authMiddleware, UserController.get);

export default router;
