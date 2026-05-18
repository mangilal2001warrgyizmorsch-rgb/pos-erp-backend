import express from 'express';
const router = express.Router();
import {
  getPurchases,
  getPurchase,
  createPurchase,
  getUnpaidPurchases,
} from '../controllers/purchaseController.js';
import {
  getUnreturnedPurchasesForSupplier,
  getReturnableItemsFromPurchase,
} from '../controllers/purchaseReturnController.js';
import { protect } from '../middleware/auth.js';
import { purchaseValidator } from '../validators/index.js';

router.use(protect);

router.get('/unpaid/:supplierId', getUnpaidPurchases);
router.get('/supplier/:supplierId/unreturned', getUnreturnedPurchasesForSupplier);
router.get('/:id/returnable-items', getReturnableItemsFromPurchase);
router.route('/').get(getPurchases).post(purchaseValidator, createPurchase);
router.route('/:id').get(getPurchase);

export default router;
