import express from 'express';
const router = express.Router();
import {
  getTransporters,
  getTransporter,
  createTransporter,
  updateTransporter,
  deleteTransporter,
} from '../controllers/transporterController.js';
import { protect, authorize } from '../middleware/auth.js';
import { transporterValidator } from '../validators/index.js';

router.use(protect);

router.route('/').get(getTransporters).post(authorize('admin', 'manager', 'stock_manager'), transporterValidator, createTransporter);
router.route('/:id').get(getTransporter).put(authorize('admin', 'manager'), updateTransporter).delete(authorize('admin', 'manager'), deleteTransporter);

export default router;
