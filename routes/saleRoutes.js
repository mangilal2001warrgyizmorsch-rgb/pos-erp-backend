import express from 'express';
const router = express.Router();
import {
  createSale,
  getSales,
  getSale,
  getDashboardStats,
  getSalesReport,
  cancelSale,
  getUnpaidSales,
} from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';
import { saleValidator } from '../validators/index.js';

router.use(protect);

router.get('/stats/dashboard', getDashboardStats);
router.get('/reports/sales', getSalesReport);
router.get('/unpaid/:customerId', getUnpaidSales);
router.route('/').get(getSales).post(saleValidator, createSale);
router.route('/:id').get(getSale);
router.route('/:id/cancel').put(cancelSale);

export default router;
