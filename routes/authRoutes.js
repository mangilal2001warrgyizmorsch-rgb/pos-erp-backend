import express from 'express';
const router = express.Router();
import { register, login, getMe, updateProfile, forgotPassword, resetPassword, changePassword, getUsers, updateUserRole } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import { registerValidator, loginValidator } from '../validators/index.js';

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// User management routes (Admin only)
router.get('/users', protect, authorize('admin'), getUsers);
router.put('/users/:id', protect, authorize('admin'), updateUserRole);

export default router;
