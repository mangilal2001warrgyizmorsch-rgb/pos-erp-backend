import express from 'express';
const router = express.Router();
import {
  getExpenses,
  getExpense,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseLedgers,
  quickCreateLedger,
} from '../controllers/expenseController.js';
import { protect, authorize } from '../middleware/auth.js';

router.use(protect);

router.get('/reports/summary', getExpenseSummary);
router.get('/ledgers', getExpenseLedgers);
router.post('/ledgers/quick-create', authorize('admin', 'manager', 'accountant'), quickCreateLedger);
router.route('/').get(getExpenses).post(authorize('admin', 'manager', 'accountant'), createExpense);
router.route('/:id').get(getExpense).put(authorize('admin', 'manager', 'accountant'), updateExpense).delete(authorize('admin', 'manager', 'accountant'), deleteExpense);

export default router;
