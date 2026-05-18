import express from 'express';
import {
  getTransactions,
  getTransactionById,
  getSummary,
  getAccounts,
  createCashEntry,
  createBankTransfer,
  reverseTransactionController,
  createAccount,
  updateAccount
} from '../controllers/cashBankController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/summary', getSummary);
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);
router.post('/cash-entry', createCashEntry);
router.post('/bank-transfer', createBankTransfer);
router.post('/transactions/:id/reverse', reverseTransactionController);
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.put('/accounts/:id', updateAccount);

export default router;
