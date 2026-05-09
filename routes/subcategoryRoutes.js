import express from 'express';
const router = express.Router();
import { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory } from '../controllers/subcategoryController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.route('/')
  .get(getSubcategories)
  .post(createSubcategory);

router.route('/:id')
  .put(updateSubcategory)
  .delete(deleteSubcategory);

export default router;
