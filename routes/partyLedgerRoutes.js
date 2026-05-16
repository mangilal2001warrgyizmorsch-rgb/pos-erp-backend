import express from 'express';
import { getLedger } from '../controllers/partyLedgerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/:partyId', getLedger);

export default router;
