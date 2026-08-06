import express from 'express';
const router = express.Router();
import {
  createSaleReturn,
  getSaleReturns,
  getSaleReturn,
  updateSaleReturn,
  deleteSaleReturn,
  cancelSaleReturn,
  getUnreturnedSalesForCustomer,
  getReturnableItemsFromSale,
} from '../controllers/saleReturnController.js';
import { protect, authorize } from '../middleware/auth.js';

router.use(protect);

// Get unreturned sales for a customer
router.get('/customer/:customerId/unreturned', getUnreturnedSalesForCustomer);

// Get returnable items from a sale
router.get('/invoice/:id/returnable-items', getReturnableItemsFromSale);

// Main CRUD routes
router.route('/').get(getSaleReturns).post(authorize('admin', 'manager'), createSaleReturn);
router.route('/:id').get(getSaleReturn).put(authorize('admin', 'manager'), updateSaleReturn).delete(authorize('admin', 'manager'), deleteSaleReturn);
router.route('/:id/cancel').post(authorize('admin', 'manager'), cancelSaleReturn);

export default router;
