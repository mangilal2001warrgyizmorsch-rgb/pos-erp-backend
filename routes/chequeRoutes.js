import express from 'express';
import { createCheque, getCheques, updateCheque, deleteCheque } from '../controllers/chequeController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCheques)
  .post(authorize('admin', 'accountant'), createCheque);

router.route('/:id')
  .put(authorize('admin', 'accountant'), updateCheque)
  .delete(authorize('admin', 'accountant'), deleteCheque);

export default router;
