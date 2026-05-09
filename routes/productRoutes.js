import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';
import { productValidator } from '../validators/index.js';

router.use(protect);

router.get('/stats/overview', getProductStats);
router.route('/').get(getProducts).post(authorize('admin'), productValidator, createProduct);
router
  .route('/:id')
  .get(getProduct)
  .put(authorize('admin'), updateProduct)
  .delete(authorize('admin'), deleteProduct);

export default router;
