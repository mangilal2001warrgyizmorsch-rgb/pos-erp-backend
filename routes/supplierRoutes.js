import express from 'express';
const router = express.Router();
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController.js';
import { protect, authorize } from '../middleware/auth.js';
import { supplierValidator } from '../validators/index.js';

router.use(protect);

router.get('/search', getSuppliers);

router.route('/').get(getSuppliers).post(authorize('admin', 'manager', 'stock_manager'), supplierValidator, createSupplier);
router.route('/:id').get(getSupplier).put(authorize('admin', 'manager'), updateSupplier).delete(authorize('admin', 'manager'), deleteSupplier);

export default router;
