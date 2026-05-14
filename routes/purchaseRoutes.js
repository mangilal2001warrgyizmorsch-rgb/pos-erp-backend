import express from 'express';
const router = express.Router();
import {
  getPurchases,
  getPurchase,
  createPurchase,
} from '../controllers/purchaseController.js';
import { protect } from '../middleware/auth.js';
import { purchaseValidator } from '../validators/index.js';

router.use(protect);

router.route('/').get(getPurchases).post(purchaseValidator, createPurchase);
router.route('/:id').get(getPurchase);

export default router;
