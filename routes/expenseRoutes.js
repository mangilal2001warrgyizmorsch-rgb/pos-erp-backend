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
import { protect } from '../middleware/auth.js';

router.use(protect);

router.get('/reports/summary', getExpenseSummary);
router.get('/ledgers', getExpenseLedgers);
router.post('/ledgers/quick-create', quickCreateLedger);
router.route('/').get(getExpenses).post(createExpense);
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

export default router;
