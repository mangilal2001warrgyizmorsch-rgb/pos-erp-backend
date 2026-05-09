import express from 'express';
const router = express.Router();
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';
import { customerValidator } from '../validators/index.js';

router.use(protect);

router.route('/').get(getCustomers).post(customerValidator, createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);

export default router;
