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
  updateSale,
  deleteSale,
} from '../controllers/saleController.js';
import {
  getUnreturnedSalesForCustomer,
  getReturnableItemsFromSale,
} from '../controllers/saleReturnController.js';
import { protect, authorize } from '../middleware/auth.js';
import { saleValidator } from '../validators/index.js';

router.use(protect);

router.get('/stats/dashboard', getDashboardStats);
router.get('/reports/sales', getSalesReport);
router.get('/unpaid/:customerId', getUnpaidSales);
router.get('/customer/:customerId/unreturned', getUnreturnedSalesForCustomer);
router.get('/:id/returnable-items', getReturnableItemsFromSale);
router.route('/').get(getSales).post(authorize('admin', 'manager', 'cashier'), saleValidator, createSale);
router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'manager'), updateSale)
  .delete(authorize('admin', 'manager'), deleteSale);
router.route('/:id/cancel').put(authorize('admin', 'manager'), cancelSale);

export default router;
