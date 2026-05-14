import express from 'express';
import {
  getInventoryReport,
  getSalesReport,
  getRevenueReport,
  getPurchaseReport,
} from '../controllers/reportsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/inventory', getInventoryReport);
router.get('/sales', getSalesReport);
router.get('/revenue', getRevenueReport);
router.get('/purchases', getPurchaseReport);

export default router;
