import express from 'express';
const router = express.Router();
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.route('/').get(getExpenses).post(createExpense);
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

export default router;
