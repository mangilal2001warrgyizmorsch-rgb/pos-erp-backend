import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { recordStockMovement } from '../utils/stockMovement.js';

// @desc    Create sale (with inventory reduction)
// @route   POST /api/sales
export const createSale = async (req, res, next) => {
  try {
    const {
      items,
      customer,
      customerName,
      subtotal,
      taxRate,
      taxAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      discountType,
      discountValue,
      discountAmount,
      totalAmount,
      paymentMethod,
      paymentStatus,
      amountPaid,
      changeAmount,
      notes,
    } = req.body;

    const saleItems = [];
    
    // Deduct stock and validate
    for (const item of items) {
      // 1. Check aggregate stock first
      const product = await Product.findOne({ _id: item.product, stock: { $gte: item.quantity }, isActive: true });
      if (!product) {
        throw new Error(`Insufficient aggregate stock for product ${item.product}`);
      }

      // 2. Fetch appropriate batches (FIFO logic by default)
      const batches = await StockBatch.find({
        productId: item.product,
        availableQty: { $gt: 0 }
      }).sort({ createdAt: 1 });

      let remainingToDeduct = item.quantity;
      let totalPurchaseCost = 0;

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductQty = Math.min(batch.availableQty, remainingToDeduct);
        batch.availableQty -= deductQty;
        totalPurchaseCost += deductQty * batch.purchasePrice;
        remainingToDeduct -= deductQty;

        await batch.save();
      }

      if (remainingToDeduct > 0 && batches.length === 0) {
        totalPurchaseCost = 0;
        remainingToDeduct = 0;
      } else if (remainingToDeduct > 0) {
        throw new Error(`Insufficient batch-wise stock for "${product.name}". Required: ${item.quantity}`);
      }

      // 3. Update Aggregate Product Stock
      product.stock -= item.quantity;
      await product.save();

      const avgPurchasePrice = item.quantity > 0 ? totalPurchaseCost / item.quantity : 0;

      saleItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        purchasePrice: avgPurchasePrice,
        profitAmount: (item.unitPrice * item.quantity) - totalPurchaseCost,
        taxRate: item.taxRate || 0,
        cgst: item.cgst || 0,
        sgst: item.sgst || 0,
        igst: item.igst || 0,
        total: item.unitPrice * item.quantity,
        _previousStock: product.stock + item.quantity,
        _newStock: product.stock,
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateSequenceNumber('INV');

    // Create the sale
    const sale = new Sale({
      invoiceNumber,
      items: saleItems.map(({ _previousStock, _newStock, ...rest }) => rest),
      customer: customer || undefined,
      customerName: customerName || 'Walk-in Customer',
      subtotal,
      taxRate: taxRate || 0,
      taxAmount: taxAmount || 0,
      totalCgst: totalCgst || 0,
      totalSgst: totalSgst || 0,
      totalIgst: totalIgst || 0,
      discountType: discountType || 'fixed',
      discountValue: discountValue || 0,
      discountAmount: discountAmount || 0,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      amountPaid: amountPaid || totalAmount,
      changeAmount: changeAmount || 0,
      notes,
      cashier: req.user._id,
    });

    await sale.save();

    // Record stock movements
    for (const item of saleItems) {
      await recordStockMovement({
        productId: item.product,
        productName: item.name,
        type: 'sale',
        quantity: -item.quantity,
        previousStock: item._previousStock,
        newStock: item._newStock,
        reference: invoiceNumber,
        referenceId: sale._id,
        createdBy: req.user._id,
      });
    }

    // Update customer stats if customer exists
    if (customer) {
      await Customer.findByIdAndUpdate(
        customer,
        {
          $inc: {
            totalPurchases: 1,
            totalSpent: totalAmount,
          },
        }
      );
    }

    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name email')
      .populate('items.product', 'name sku');

    res.status(201).json({
      success: true,
      data: populatedSale,
    });
  } catch (error) {
    if (error.message.includes('Insufficient') || error.message.includes('Product not found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
export const getSales = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      paymentMethod,
      status,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('cashier', 'name')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: sales,
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

// @desc    Get single sale
// @route   GET /api/sales/:id
export const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name phone email address')
      .populate('cashier', 'name email')
      .populate('items.product', 'name sku image');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel sale and restore stock
// @route   PUT /api/sales/:id/cancel
export const cancelSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    if (sale.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Sale is already cancelled',
      });
    }

    // Restore stock and log movements
    for (const item of sale.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );

      if (product) {
        await recordStockMovement({
          productId: product._id,
          productName: product.name,
          type: 'cancellation',
          quantity: item.quantity,
          previousStock: product.stock - item.quantity,
          newStock: product.stock,
          reference: sale.invoiceNumber,
          referenceId: sale._id,
          notes: 'Sale cancelled',
          createdBy: req.user._id,
        });
      }
    }

    // Update sale status
    sale.status = 'cancelled';
    await sale.save();

    // Update customer stats if customer exists
    if (sale.customer) {
      await Customer.findByIdAndUpdate(
        sale.customer,
        {
          $inc: {
            totalPurchases: -1,
            totalSpent: -sale.totalAmount,
          },
        }
      );
    }

    res.status(200).json({
      success: true,
      data: sale,
      message: 'Sale cancelled and stock restored successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/sales/stats/dashboard
export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Today's sales
    const todaySales = await Sale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Monthly sales
    const monthlySales = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Sales by month (last 12 months)
    const salesByMonth = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1) },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Sales by day (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesByDay = await Sale.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top selling products
    const topProducts = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    // Recent sales
    const recentSales = await Sale.find({ status: 'completed' })
      .populate('customer', 'name')
      .populate('cashier', 'name')
      .sort('-createdAt')
      .limit(10);

    // Payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .select('name stock lowStockThreshold sku')
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        today: todaySales[0] || { totalSales: 0, totalRevenue: 0 },
        monthly: monthlySales[0] || { totalSales: 0, totalRevenue: 0 },
        totalCustomers,
        totalProducts,
        salesByMonth,
        salesByDay,
        topProducts,
        recentSales,
        lowStockProducts,
        paymentBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales report
// @route   GET /api/sales/reports/sales
export const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const match = { status: 'completed' };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    let groupFormat;
    switch (groupBy) {
      case 'month':
        groupFormat = '%Y-%m';
        break;
      case 'year':
        groupFormat = '%Y';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    const report = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        report,
        summary: summary[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          totalTax: 0,
          avgOrderValue: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
