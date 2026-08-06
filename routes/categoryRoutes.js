import express from 'express';
const router = express.Router();
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { categoryValidator } from '../validators/index.js';

router.use(protect);

router.route('/').get(getCategories).post(authorize('admin', 'manager', 'stock_manager'), categoryValidator, createCategory);
router
  .route('/:id')
  .put(authorize('admin', 'manager', 'stock_manager'), updateCategory)
  .delete(authorize('admin', 'manager', 'stock_manager'), deleteCategory);

export default router;
