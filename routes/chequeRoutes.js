import express from 'express';
import { createCheque, getCheques } from '../controllers/chequeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCheques)
  .post(createCheque);

export default router;
