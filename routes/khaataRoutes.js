import express from 'express';
import {
  getKhaataBalances,
  getKhaataTransactions,
  addKhaataTransaction,
  logAndSendReminder,
  getReminderLogs
} from '../controllers/khaataController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth protection to all routes
router.use(protect);

router.route('/balances').get(getKhaataBalances);
router.get('/:partyId/transactions', protect, getKhaataTransactions);

// Manual transaction
router.post('/:partyId/transaction', protect, addKhaataTransaction);

// WhatsApp Reminders
router.post('/:partyId/remind', protect, logAndSendReminder);
router.get('/:partyId/reminders', protect, getReminderLogs);

export default router;
