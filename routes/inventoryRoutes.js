import express from 'express';
const router = express.Router();
import { createOpeningStockEntry, getStockHistory } from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.post('/opening-stock', createOpeningStockEntry);
router.get('/history', getStockHistory);

export default router;
