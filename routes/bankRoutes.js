import express from 'express';
import { createBankAccount, getBankAccounts, createTransaction, getTransactions } from '../controllers/bankController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBankAccounts)
  .post(createBankAccount);

router.route('/transaction')
  .get(getTransactions)
  .post(createTransaction);

export default router;
