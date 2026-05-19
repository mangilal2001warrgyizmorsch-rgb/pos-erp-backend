import express from 'express';
import { createCheque, getCheques, updateCheque, deleteCheque } from '../controllers/chequeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCheques)
  .post(createCheque);

router.route('/:id')
  .put(updateCheque)
  .delete(deleteCheque);

export default router;
