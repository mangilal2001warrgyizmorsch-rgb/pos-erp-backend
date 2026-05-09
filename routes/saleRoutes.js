import express from 'express';
const router = express.Router();
import {
  createSale,
  getSales,
  getSale,
  getDashboardStats,
  getSalesReport,
} from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';
import { saleValidator } from '../validators/index.js';

router.use(protect);

router.get('/stats/dashboard', getDashboardStats);
router.get('/reports/sales', getSalesReport);
router.route('/').get(getSales).post(saleValidator, createSale);
router.route('/:id').get(getSale);

export default router;
