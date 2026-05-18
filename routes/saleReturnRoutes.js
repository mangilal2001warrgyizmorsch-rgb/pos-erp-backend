import express from 'express';
const router = express.Router();
import {
  createSaleReturn,
  getSaleReturns,
  getSaleReturn,
  updateSaleReturn,
  cancelSaleReturn,
  getUnreturnedSalesForCustomer,
  getReturnableItemsFromSale,
} from '../controllers/saleReturnController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

// Get unreturned sales for a customer
router.get('/customer/:customerId/unreturned', getUnreturnedSalesForCustomer);

// Get returnable items from a sale
router.get('/invoice/:id/returnable-items', getReturnableItemsFromSale);

// Main CRUD routes
router.route('/').get(getSaleReturns).post(createSaleReturn);
router.route('/:id').get(getSaleReturn).put(updateSaleReturn);
router.route('/:id/cancel').post(cancelSaleReturn);

export default router;
