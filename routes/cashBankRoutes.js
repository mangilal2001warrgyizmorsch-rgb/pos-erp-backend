import express from 'express';
import { getTransactions, getSummary } from '../controllers/cashBankController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/transactions', getTransactions);
router.get('/summary', getSummary);

export default router;
