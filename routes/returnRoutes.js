import express from 'express';
const router = express.Router();
import { createSalesReturn, getSalesReturns, createPurchaseReturn, getPurchaseReturns } from '../controllers/returnController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.route('/sales').get(getSalesReturns).post(createSalesReturn);
router.route('/purchases').get(getPurchaseReturns).post(createPurchaseReturn);

export default router;
