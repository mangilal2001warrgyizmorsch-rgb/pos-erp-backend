import express from 'express';
import { createLoan, getLoans, updateLoan, deleteLoan } from '../controllers/loanController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getLoans)
  .post(authorize('admin', 'manager', 'accountant'), createLoan);

router.route('/:id')
  .put(authorize('admin', 'manager', 'accountant'), updateLoan)
  .delete(authorize('admin', 'manager', 'accountant'), deleteLoan);

export default router;
