import express from 'express';
import {
  getInventoryAnalytics,
  getSalesAnalytics,
  getRevenueAnalytics,
  getPurchaseAnalytics,
  getCashFlowAnalytics,
} from '../controllers/analyticsController.js';

import { protect } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes are protected
router.use(protect);

// Inventory analytics
router.get('/inventory', getInventoryAnalytics);

// Sales analytics
router.get('/sales', getSalesAnalytics);

// Revenue analytics
router.get('/revenue', getRevenueAnalytics);

// Purchase analytics
router.get('/purchases', getPurchaseAnalytics);

// Cashflow analytics
router.get('/cashflow', getCashFlowAnalytics);

export default router;
