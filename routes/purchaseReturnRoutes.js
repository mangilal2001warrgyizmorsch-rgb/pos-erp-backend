import express from 'express';
const router = express.Router();
import {
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn,
  cancelPurchaseReturn,
  getUnreturnedPurchasesForSupplier,
  getReturnableItemsFromPurchase,
} from '../controllers/purchaseReturnController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

// Get unreturned purchases for a supplier
router.get('/supplier/:supplierId/unreturned', getUnreturnedPurchasesForSupplier);

// Get returnable items from a purchase
router.get('/bill/:id/returnable-items', getReturnableItemsFromPurchase);

// Main CRUD routes
router.route('/').get(getPurchaseReturns).post(createPurchaseReturn);
router.route('/:id').get(getPurchaseReturn).put(updatePurchaseReturn).delete(deletePurchaseReturn);
router.route('/:id/cancel').post(cancelPurchaseReturn);

export default router;
