import express from 'express';
import { 
  createBankAccount, 
  getBankAccounts, 
  createTransaction, 
  getTransactions,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount 
} from '../controllers/bankController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBankAccounts)
  .post(authorize('admin', 'accountant'), createBankAccount);

router.route('/transaction')
  .get(getTransactions)
  .post(authorize('admin', 'accountant'), createTransaction);

router.route('/:id')
  .get(getBankAccountById)
  .put(authorize('admin', 'accountant'), updateBankAccount)
  .delete(authorize('admin', 'accountant'), deleteBankAccount);

export default router;
