import express from 'express';
const router = express.Router();
import { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory } from '../controllers/subcategoryController.js';
import { protect, authorize } from '../middleware/auth.js';

router.use(protect);

router.route('/')
  .get(getSubcategories)
  .post(authorize('admin', 'manager', 'stock_manager'), createSubcategory);

router.route('/:id')
  .put(authorize('admin', 'manager', 'stock_manager'), updateSubcategory)
  .delete(authorize('admin', 'manager', 'stock_manager'), deleteSubcategory);

export default router;
