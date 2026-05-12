import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';

// @desc    Create purchase (with inventory increase)
// @route   POST /api/purchases
export const createPurchase = async (req, res, next) => {
  try {
    const {
      items,
      supplier,
      transporter,
      invoiceNumber,
      subtotal,
      taxRate,
      taxAmount,
      discountValue,
      totalAmount,
      paymentMethod,
      paymentStatus,
      amountPaid,
      status,
      notes,
    } = req.body;

    // Create the purchase
    const purchase = new Purchase({
      items,
      supplier,
      transporter: transporter || undefined,
      invoiceNumber,
      subtotal,
      taxRate: taxRate || 0,
      taxAmount: taxAmount || 0,
      discountValue: discountValue || 0,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      amountPaid: amountPaid || totalAmount,
      status: status || 'confirmed',
      notes,
      createdBy: req.user._id,
    });

    // If purchase is confirmed or received, increase inventory for each item
    if (purchase.status === 'confirmed' || purchase.status === 'received') {
      for (const item of items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          product.purchasePrice = item.purchasePrice; // Update purchase price based on latest purchase
          await product.save();
        }
      }
    }

    await purchase.save();

    // Update supplier stats
    if (supplier && (purchase.status === 'confirmed' || purchase.status === 'received')) {
      await Supplier.findByIdAndUpdate(
        supplier,
        {
          $inc: {
            totalPurchases: totalAmount,
            outstandingBalance: paymentStatus !== 'paid' ? (totalAmount - amountPaid) : 0,
          },
        }
      );
    }

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name mobile gstNumber')
      .populate('transporter', 'name vehicleNumber')
      .populate('createdBy', 'name email')
      .populate('items.product', 'name sku');

    res.status(201).json({
      success: true,
      data: populatedPurchase,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all purchases
// @route   GET /api/purchases
export const getPurchases = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      status,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { purchaseNumber: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (status) query.status = status;

    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name mobile')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: purchases,
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

// @desc    Get single purchase
// @route   GET /api/purchases/:id
export const getPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier', 'name mobile address gstNumber')
      .populate('transporter', 'name mobile vehicleNumber')
      .populate('createdBy', 'name email')
      .populate('items.product', 'name sku image hsnCode unit');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};
