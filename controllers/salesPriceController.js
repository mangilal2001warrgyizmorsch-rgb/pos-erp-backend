import SalesPrice from '../models/SalesPrice.js';
import Product from '../models/Product.js';

// @desc    Get all sales prices for a product
// @route   GET /api/sales-prices/product/:productId
export const getSalesPricesByProduct = async (req, res, next) => {
  try {
    const prices = await SalesPrice.find({ productId: req.params.productId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: prices });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sales prices for a barcode
// @route   GET /api/sales-prices/barcode/:barcode
export const getSalesPricesByBarcode = async (req, res, next) => {
  try {
    const prices = await SalesPrice.find({ barcode: req.params.barcode }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: prices });
  } catch (error) {
    next(error);
  }
};

// @desc    Get the latest active sales price for a barcode
// @route   GET /api/sales-prices/latest/:barcode
export const getLatestSalesPrice = async (req, res, next) => {
  try {
    // We prioritize prices from batches that still have availableQty, sorted by most recent
    let price = await SalesPrice.findOne({
      barcode: req.params.barcode,
      pricingStatus: 'active',
      availableQty: { $gt: 0 },
    }).sort({ createdAt: -1 });

    if (!price) {
      // Fallback to any active price even if qty is 0, just to have a reference price
      price = await SalesPrice.findOne({
        barcode: req.params.barcode,
        pricingStatus: 'active',
      }).sort({ createdAt: -1 });
    }

    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'No sales price found for this barcode',
      });
    }

    res.status(200).json({ success: true, data: price });
  } catch (error) {
    next(error);
  }
};
