import express from 'express';
const router = express.Router();
import { register, login, getMe, updateProfile, forgotPassword, resetPassword, changePassword, getUsers, updateUser, createUser, deleteUser, getRoles, updateRolePermissions } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import { registerValidator, loginValidator } from '../validators/index.js';

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// User and Role management routes (Admin only)
router.get('/users', protect, authorize('admin'), getUsers);
router.post('/users', protect, authorize('admin'), createUser);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

router.get('/roles', protect, authorize('admin'), getRoles);
router.put('/roles/:id', protect, authorize('admin'), updateRolePermissions);

export default router;
