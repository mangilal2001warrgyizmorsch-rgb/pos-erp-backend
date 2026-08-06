import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductByBarcode,
  getProductPricing,
  getProductPriceOptions,
  bulkImportProducts,
  getGlobalLibrary,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';
import { productValidator } from '../validators/index.js';

router.use(protect);

router.post('/bulk-import', authorize('admin', 'manager', 'stock_manager'), bulkImportProducts);
router.get('/global-library', getGlobalLibrary);
router.get('/stats/overview', getProductStats);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id/price-options', getProductPriceOptions);
router.get('/:id/pricing', getProductPricing);
router.route('/').get(getProducts).post(authorize('admin', 'manager', 'stock_manager'), productValidator, createProduct);
router
  .route('/:id')
  .get(getProduct)
  .put(authorize('admin', 'manager', 'stock_manager'), updateProduct)
  .delete(authorize('admin', 'manager', 'stock_manager'), deleteProduct);

export default router;
