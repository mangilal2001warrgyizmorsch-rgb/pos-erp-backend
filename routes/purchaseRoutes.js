import express from 'express';
const router = express.Router();
import {
  getPurchases,
  getPurchase,
  createPurchase,
} from '../controllers/purchaseController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.route('/').get(getPurchases).post(createPurchase);
router.route('/:id').get(getPurchase);

export default router;
