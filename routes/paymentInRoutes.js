import express from 'express';
import { createPaymentIn, getPaymentIns, getPaymentInById, deletePaymentIn } from '../controllers/paymentInController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.route('/')
  .get(getPaymentIns)
  .post(createPaymentIn);

router.route('/:id')
  .get(getPaymentInById)
  .delete(deletePaymentIn);

export default router;
