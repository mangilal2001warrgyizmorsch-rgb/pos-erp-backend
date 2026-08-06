import express from 'express';
const router = express.Router();
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { protect, authorize } from '../middleware/auth.js';
import { customerValidator } from '../validators/index.js';

router.use(protect);

router.get('/search', getCustomers);

router.route('/').get(getCustomers).post(authorize('admin', 'manager', 'cashier'), customerValidator, createCustomer);
router.route('/:id').get(getCustomer).put(authorize('admin', 'manager'), updateCustomer).delete(authorize('admin', 'manager'), deleteCustomer);

export default router;
