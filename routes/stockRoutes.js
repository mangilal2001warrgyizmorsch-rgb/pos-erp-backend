import express from 'express';
import {
  createStockAdjustment,
  getCurrentStock,
  getLowStockAlerts,
  getStockAdjustments,
  getStockStats,
} from '../controllers/stockController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getCurrentStock);
router.get('/adjustments', getStockAdjustments);
router.post('/adjustments', createStockAdjustment);
router.get('/alerts', getLowStockAlerts);
router.get('/stats', getStockStats);

export default router;
