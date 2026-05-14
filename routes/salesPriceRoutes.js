import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getSalesPricesByProduct,
  getSalesPricesByBarcode,
  getLatestSalesPrice,
} from '../controllers/salesPriceController.js';

const router = express.Router();

router.use(protect);

router.get('/product/:productId', getSalesPricesByProduct);
router.get('/barcode/:barcode', getSalesPricesByBarcode);
router.get('/latest/:barcode', getLatestSalesPrice);

export default router;
