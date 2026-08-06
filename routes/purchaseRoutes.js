import express from 'express';
const router = express.Router();
import {
  getPurchases,
  getPurchase,
  createPurchase,
  getUnpaidPurchases,
  deletePurchase,
  updatePurchase,
} from '../controllers/purchaseController.js';
import {
  getUnreturnedPurchasesForSupplier,
  getReturnableItemsFromPurchase,
} from '../controllers/purchaseReturnController.js';
import { protect, authorize } from '../middleware/auth.js';
import { purchaseValidator } from '../validators/index.js';

router.use(protect);

router.get('/unpaid/:supplierId', getUnpaidPurchases);
router.get('/supplier/:supplierId/unreturned', getUnreturnedPurchasesForSupplier);
router.get('/:id/returnable-items', getReturnableItemsFromPurchase);
router.route('/').get(getPurchases).post(authorize('admin', 'manager', 'stock_manager'), purchaseValidator, createPurchase);
router.route('/:id')
  .get(getPurchase)
  .put(authorize('admin', 'manager', 'stock_manager'), updatePurchase)
  .delete(authorize('admin', 'manager', 'stock_manager'), deletePurchase);

export default router;
