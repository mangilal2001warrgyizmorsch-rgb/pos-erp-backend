import express from 'express';
const router = express.Router();
import { getStockHistory } from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.get('/history', getStockHistory);

export default router;
