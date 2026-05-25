import express from 'express';
import { createPaymentOut, getPaymentOuts, getPaymentOutById, deletePaymentOut, updatePaymentOut } from '../controllers/paymentOutController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.route('/')
  .get(getPaymentOuts)
  .post(createPaymentOut);

router.route('/:id')
  .get(getPaymentOutById)
  .put(updatePaymentOut)
  .delete(deletePaymentOut);

export default router;
