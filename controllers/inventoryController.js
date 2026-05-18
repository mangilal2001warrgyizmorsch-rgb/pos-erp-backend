import StockMovement from '../models/StockMovement.js';

// @desc    Get all stock movements / stock history
// @route   GET /api/inventory/history
// @access  Private
export const getStockHistory = async (req, res) => {
  try {
    const { productId, type, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};

    if (productId) {
      query.product = productId;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await StockMovement.countDocuments(query);
    const movements = await StockMovement.find(query)
      .populate('product', 'name sku barcode unit')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: movements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
