import express from 'express';
import { createLoan, getLoans } from '../controllers/loanController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getLoans)
  .post(createLoan);

export default router;
