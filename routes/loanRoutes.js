import express from 'express';
import { createLoan, getLoans, updateLoan, deleteLoan } from '../controllers/loanController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getLoans)
  .post(createLoan);

router.route('/:id')
  .put(updateLoan)
  .delete(deleteLoan);

export default router;
