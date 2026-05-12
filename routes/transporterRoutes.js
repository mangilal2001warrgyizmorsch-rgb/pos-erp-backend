import express from 'express';
const router = express.Router();
import {
  getTransporters,
  getTransporter,
  createTransporter,
  updateTransporter,
  deleteTransporter,
} from '../controllers/transporterController.js';
import { protect } from '../middleware/auth.js';
import { transporterValidator } from '../validators/index.js';

router.use(protect);

router.route('/').get(getTransporters).post(transporterValidator, createTransporter);
router.route('/:id').get(getTransporter).put(updateTransporter).delete(deleteTransporter);

export default router;
