import express from 'express';
const router = express.Router();
import { register, login, getMe, updateProfile, forgotPassword, resetPassword, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { registerValidator, loginValidator } from '../validators/index.js';

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

export default router;
