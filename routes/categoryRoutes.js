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

router.route('/').get(getCategories).post(authorize('admin'), categoryValidator, createCategory);
router
  .route('/:id')
  .put(authorize('admin'), updateCategory)
  .delete(authorize('admin'), deleteCategory);

export default router;
