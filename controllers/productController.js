import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import SalesPrice from '../models/SalesPrice.js';
import StockMovement from '../models/StockMovement.js';

// @desc    Get all products
// @route   GET /api/products
export const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      lowStock,
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

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

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get dynamic pricing for product based on latest/FIFO batch
// @route   GET /api/products/:id/pricing
export const getProductPricing = async (req, res, next) => {
  try {
    const { strategy = 'latest' } = req.query;

    const sort = strategy === 'latest' ? { createdAt: -1 } : { createdAt: 1 };

    let priceEntry = await SalesPrice.findOne({
      productId: req.params.id,
      pricingStatus: 'active',
      availableQty: { $gt: 0 }
    }).sort(sort);

    if (!priceEntry) {
      priceEntry = await SalesPrice.findOne({ productId: req.params.id, pricingStatus: 'active' }).sort({ createdAt: -1 });
    }

    if (!priceEntry) {
      // Fallback for products with no pricing
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          productId: product._id,
          batchNo: 'INITIAL-STOCK',
          purchasePrice: product.purchasePrice || 0,
          salesPrice: product.salesPrice || 0,
          availableQty: product.stock,
          taxPercent: product.taxRate || 0
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        productId: priceEntry.productId,
        batchNo: priceEntry.batchId ? priceEntry.batchId.toString() : 'PRICING-RECORD',
        purchasePrice: priceEntry.purchasePrice,
        salesPrice: priceEntry.calculatedSalePrice,
        availableQty: priceEntry.availableQty,
        taxPercent: priceEntry.taxPercent
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by barcode (for fast scanning)
// @route   GET /api/products/barcode/:barcode
export const getProductByBarcode = async (req, res, next) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode, isActive: true })
      .populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    
    // Create stock batch and stock movement if stock > 0
    if (product.stock > 0) {
      const batchNo = `INITIAL-STOCK-${product._id.toString().slice(-4).toUpperCase()}`;
      
      // 1. Create StockBatch
      const batch = await StockBatch.create({
        productId: product._id,
        batchNo,
        quantity: product.stock,
        availableQty: product.stock,
        purchasePrice: product.purchasePrice || 0,
        taxPercent: product.taxRate || 0,
        salePrice: product.salesPrice || product.purchasePrice || 0,
        barcode: product.barcode || product.sku
      });

      // 2. Create SalesPrice Record
      await SalesPrice.create({
        productId: product._id,
        batchId: batch._id,
        barcode: product.barcode || product.sku,
        purchasePrice: product.purchasePrice || 0,
        taxPercent: product.taxRate || 0,
        calculatedSalePrice: product.salesPrice || product.purchasePrice || 0,
        availableQty: product.stock,
        pricingStatus: 'active',
      });

      // 3. Create StockMovement
      await StockMovement.create({
        product: product._id,
        productName: product.name,
        type: 'adjustment',
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reference: 'INITIAL-STOCK',
        notes: 'Initial opening stock entry',
        createdBy: req.user?._id || product._id
      });
    }

    const populated = await product.populate('category', 'name');

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
export const updateProduct = async (req, res, next) => {
  try {
    const oldProduct = await Product.findById(req.params.id);
    const oldStock = oldProduct ? (oldProduct.stock || 0) : 0;

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const newStock = product.stock || 0;
    const diff = newStock - oldStock;

    if (diff !== 0) {
      const isPositive = diff > 0;
      const batchNo = `ADJ-${Date.now()}-${product._id.toString().slice(-4).toUpperCase()}`;

      if (isPositive) {
        // 1. Create StockBatch for the new added quantity
        const batch = await StockBatch.create({
          productId: product._id,
          batchNo,
          quantity: diff,
          availableQty: diff,
          purchasePrice: product.purchasePrice || 0,
          taxPercent: product.taxRate || 0,
          salePrice: product.salesPrice || product.purchasePrice || 0,
          barcode: product.barcode || product.sku
        });

        // 2. Create SalesPrice Record
        await SalesPrice.create({
          productId: product._id,
          batchId: batch._id,
          barcode: product.barcode || product.sku,
          purchasePrice: product.purchasePrice || 0,
          taxPercent: product.taxRate || 0,
          calculatedSalePrice: product.salesPrice || product.purchasePrice || 0,
          availableQty: diff,
          pricingStatus: 'active',
        });
      }

      // 3. Create StockMovement
      await StockMovement.create({
        product: product._id,
        productName: product.name,
        type: 'adjustment',
        quantity: diff,
        previousStock: oldStock,
        newStock: newStock,
        reference: 'STOCK-ADJUSTMENT',
        notes: `Stock adjusted by ${diff > 0 ? '+' : ''}${diff}. Opening stock update.`,
        createdBy: req.user?._id || product._id
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product stats
// @route   GET /api/products/stats/overview
export const getProductStats = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    });
    const outOfStock = await Product.countDocuments({
      isActive: true,
      stock: 0,
    });
    const totalValue = await StockBatch.aggregate([
      { $match: { availableQty: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$availableQty', '$salesPrice'] } },
          totalCost: { $sum: { $multiply: ['$availableQty', '$purchasePrice'] } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        lowStockProducts,
        outOfStock,
        inventoryValue: totalValue[0]?.totalValue || 0,
        inventoryCost: totalValue[0]?.totalCost || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
