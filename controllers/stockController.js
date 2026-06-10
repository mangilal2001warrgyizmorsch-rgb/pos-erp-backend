import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';

export const getCurrentStock = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) query.category = category;
    if (status === 'out_of_stock') query.stock = { $lte: 0 };
    if (status === 'in_stock') query.stock = { $gt: 0 };
    if (status === 'low_stock') query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStockAdjustments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { type: 'adjustment' };
    const total = await StockMovement.countDocuments(query);
    const adjustments = await StockMovement.find(query)
      .populate('product', 'name sku barcode unit')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: adjustments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStockAdjustment = async (req, res, next) => {
  try {
    const { product: productId, adjustedStock, reason, notes } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const nextStock = Number(adjustedStock);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      return res.status(400).json({ success: false, message: 'Adjusted stock must be a non-negative number' });
    }

    const previousStock = product.stock || 0;
    if (nextStock === previousStock) {
      return res.status(400).json({ success: false, message: 'Adjusted stock must be different from current stock' });
    }

    product.stock = nextStock;
    await product.save();

    const movement = await StockMovement.create({
      product: product._id,
      productName: product.name,
      type: 'adjustment',
      quantity: nextStock - previousStock,
      previousStock,
      newStock: nextStock,
      reference: 'STOCK-ADJUSTMENT',
      notes: notes || reason || 'Manual stock adjustment',
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    next(error);
  }
};

export const getLowStockAlerts = async (req, res, next) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    }).populate('category', 'name');

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

export const getStockStats = async (req, res, next) => {
  try {
    const [summary] = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          stockValue: { $sum: { $multiply: ['$stock', '$purchasePrice'] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: summary || {
        totalProducts: 0,
        totalStock: 0,
        stockValue: 0,
        outOfStock: 0,
        lowStock: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
