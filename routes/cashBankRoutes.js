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
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/summary', getSummary);
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);
router.post('/cash-entry', authorize('admin', 'accountant'), createCashEntry);
router.post('/bank-transfer', authorize('admin', 'accountant'), createBankTransfer);
router.post('/transactions/:id/reverse', authorize('admin', 'accountant'), reverseTransactionController);
router.get('/accounts', getAccounts);
router.post('/accounts', authorize('admin', 'accountant'), createAccount);
router.put('/accounts/:id', authorize('admin', 'accountant'), updateAccount);

export default router;
