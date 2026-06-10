import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.js';

router.use(protect);

const legacyReturnsDisabled = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Legacy return endpoints are disabled. Use /api/sales-returns or /api/purchases-returns.',
  });
};

router.route('/sales').get(legacyReturnsDisabled).post(legacyReturnsDisabled);
router.route('/purchases').get(legacyReturnsDisabled).post(legacyReturnsDisabled);

export default router;
