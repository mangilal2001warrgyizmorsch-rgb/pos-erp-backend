import express from 'express';
const router = express.Router();
import {
  openShift,
  getCurrentShift,
  closeShift,
} from '../controllers/shiftController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.post('/open', openShift);
router.get('/current', getCurrentShift);
router.put('/close', closeShift);

export default router;
