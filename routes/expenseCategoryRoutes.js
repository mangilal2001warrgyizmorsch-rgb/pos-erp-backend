import express from 'express';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategories,
  updateExpenseCategory,
} from '../controllers/expenseCategoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getExpenseCategories).post(createExpenseCategory);
router.route('/:id').put(updateExpenseCategory).delete(deleteExpenseCategory);

export default router;
