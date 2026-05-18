import express from 'express';
const router = express.Router();
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController.js';
import { protect } from '../middleware/auth.js';
import { supplierValidator } from '../validators/index.js';

router.use(protect);

router.get('/search', getSuppliers);

router.route('/').get(getSuppliers).post(supplierValidator, createSupplier);
router.route('/:id').get(getSupplier).put(updateSupplier).delete(deleteSupplier);

export default router;
