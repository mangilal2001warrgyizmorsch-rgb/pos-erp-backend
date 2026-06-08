import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import StockBatch from '../models/StockBatch.js';
import StockMovement from '../models/StockMovement.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';
import { inventoryService } from '../services/inventoryService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { emitSocketEvent } from '../utils/socket.js';
import { recordStockMovement } from '../utils/stockMovement.js';
import BankAccount from '../models/BankAccount.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import PartyLedger from '../models/PartyLedger.js';
import {
  markSaleAccountingFailure,
  postSaleAccountingVoucher,
} from '../services/accounting/salesAccounting.service.js';

// @desc    Create sale (with inventory reduction)
// @route   POST /api/sales
export const createSale = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

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
      cashBankAccountId,
    } = req.body;

    const saleItems = [];
    const invoiceNumber = await generateSequenceNumber('INV', session);

    // Deduct stock and validate
    for (const item of items) {
      // 1. Fetch appropriate batches (FIFO logic by default) to calculate average purchase price
      const product = await Product.findOne({ _id: item.product, isActive: true }).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      // Check stock before hand
      if ((product.stock || 0) < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }

      // Compute average purchase price from active FIFO batches for correct profit margins
      const batches = await StockBatch.find({
        productId: item.product,
        availableQty: { $gt: 0 }
      }).sort({ createdAt: 1 }).session(session);

      let remainingToDeduct = item.quantity;
      let totalPurchaseCost = 0;

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deductQty = Math.min(batch.availableQty, remainingToDeduct);
        totalPurchaseCost += deductQty * batch.purchasePrice;
        remainingToDeduct -= deductQty;
      }

      const avgPurchasePrice = item.quantity > 0 ? totalPurchaseCost / item.quantity : 0;

      // 2. Call inventoryService to handle FIFO batch deduction, Product.stock update, and StockMovement log in transaction
      await inventoryService.deductStock({
        productId: item.product,
        quantity: item.quantity,
        reference: invoiceNumber,
        referenceId: null, // assigned below after sale saves
        notes: `Sale invoice ${invoiceNumber}`,
        createdBy: req.user._id
      }, session);

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
      });
    }

    // Create the sale record
    const sale = new Sale({
      invoiceNumber,
      items: saleItems,
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
      cashBankAccountId,
      cashier: req.user._id,
    });

    await sale.save({ session });

    // Update referenceIds on StockMovement records
    await StockMovement.updateMany(
      { reference: invoiceNumber, referenceId: null },
      { $set: { referenceId: sale._id } }
    ).session(session);

    // Update customer stats if customer exists
    if (customer) {
      await Customer.findByIdAndUpdate(
        customer,
        {
          $inc: {
            totalPurchases: 1,
            totalSpent: totalAmount,
          },
        },
        { session }
      );

      // Always create double-entry Party Ledger entry for all customer sales
      await partyLedgerService.createEntry({
        partyId: customer,
        partyType: 'Customer',
        type: 'sale',
        debitAmount: Number(totalAmount),
        creditAmount: Number(amountPaid || 0),
        referenceId: sale._id,
        receiptNo: invoiceNumber,
        notes: `Sale Invoice ${invoiceNumber}. Total: ₹${totalAmount}, Paid: ₹${amountPaid}`,
        date: new Date()
      }, session);
    }

    // Log payment in central Cash/Bank transaction log if paid
    if (sale.amountPaid > 0) {
      await createCashBankTransaction({
        date: sale.createdAt || new Date(),
        type: 'sale_payment',
        direction: 'in',
        amount: sale.amountPaid,
        paymentMode: sale.paymentMethod || 'Cash',
        accountType: (sale.paymentMethod === 'Cash' || sale.paymentMethod === 'cash') ? 'cash' : 'bank',
        accountId: sale.cashBankAccountId || undefined,
        partyId: customer || undefined,
        partyType: 'Customer',
        referenceModule: 'sale_invoice',
        referenceId: sale._id,
        referenceNo: invoiceNumber,
        description: `Payment received for Invoice ${invoiceNumber}`,
        createdBy: req.user._id
      }, session);
    }

    if (session) {
      await session.commitTransaction();
    }

    try {
      await postSaleAccountingVoucher(sale, { createdBy: req.user._id });
    } catch (accountingError) {
      await markSaleAccountingFailure(sale._id, accountingError);
      console.error('[Accounting] Failed to post sale voucher:', accountingError);
    }

    // Emit live real-time WebSocket socket broadcast
    try {
      emitSocketEvent('sale:created', {
        _id: sale._id,
        invoiceNo: invoiceNumber,
        totalAmount,
        customerName
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit sale socket event:', e);
    }

    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name phone email walletBalance')
      .populate('cashier', 'name email')
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
      .populate('items.product', 'name sku');

    res.status(201).json({
      success: true,
      data: populatedSale,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
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
    if (req.query.customer) query.customer = req.query.customer;

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('cashier', 'name')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Calculate totals for matching query
    const totalsAggregation = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          amountPaid: { $sum: '$amountPaid' },
          balanceAmount: {
            $sum: {
              $cond: [
                { $gt: ['$totalAmount', '$amountPaid'] },
                { $subtract: ['$totalAmount', '$amountPaid'] },
                0
              ]
            }
          }
        }
      }
    ]);

    const totals = totalsAggregation[0] || { totalAmount: 0, amountPaid: 0, balanceAmount: 0 };

    res.status(200).json({
      success: true,
      data: sales,
      totals: {
        totalAmount: totals.totalAmount || 0,
        amountPaid: totals.amountPaid || 0,
        balanceAmount: totals.balanceAmount || 0
      },
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
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
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

    // Reverse the cash/bank transaction
    await reverseReferenceTransaction('sale_invoice', sale._id, req.user._id, 'Sale cancelled');

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
// @desc    Get unpaid sales for a customer
// @route   GET /api/sales/unpaid/:customerId
export const getUnpaidSales = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const sales = await Sale.find({
      customer: customerId,
      paymentStatus: { $ne: 'paid' },
      status: 'completed'
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete sale and restore stock
// @route   DELETE /api/sales/:id
export const deleteSale = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // 1. Restore stock and log movements
    for (const item of sale.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true, session }
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
          notes: 'Sale deleted',
          createdBy: req.user._id,
        }, session);

        // Restore batch quantities
        let batch = await StockBatch.findOne({ productId: product._id }).sort({ createdAt: -1 }).session(session);
        if (batch) {
          batch.availableQty += item.quantity;
          await batch.save({ session });
        }
      }
    }

    // 2. Revert customer balance and delete PartyLedger entry
    if (sale.customer) {
      await Customer.findByIdAndUpdate(
        sale.customer,
        {
          $inc: {
            totalPurchases: -1,
            totalSpent: -sale.totalAmount,
            walletBalance: -(sale.amountPaid - sale.totalAmount)
          }
        },
        { session }
      );
      await PartyLedger.deleteOne({ referenceId: sale._id }).session(session);
    }

    // 3. Revert cash/bank transaction
    const oldTransactions = await CashBankTransaction.find({ referenceId: sale._id, status: 'completed' }).session(session);
    for (const tx of oldTransactions) {
      if (tx.accountId) {
        const acc = await BankAccount.findById(tx.accountId).session(session);
        if (acc) {
          if (tx.direction === 'in') {
            acc.currentBalance -= tx.amount;
          } else {
            acc.currentBalance += tx.amount;
          }
          await acc.save({ session, validateBeforeSave: false });
        }
      }
    }
    await CashBankTransaction.deleteMany({ referenceId: sale._id }).session(session);

    // 4. Delete sale invoice document
    await Sale.findByIdAndDelete(sale._id).session(session);

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast WebSocket updates
    try {
      emitSocketEvent('sale:deleted', { _id: sale._id });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit sale event:', e);
    }

    res.status(200).json({ success: true, message: 'Sale deleted and stock restored successfully' });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};

// @desc    Update sale and adjust inventory/ledger
// @route   PUT /api/sales/:id
export const updateSale = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

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
      cashBankAccountId,
    } = req.body;

    // 1. REVERSAL PHASE (of old sale)
    for (const item of sale.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true, session }
      );
      if (product) {
        let batch = await StockBatch.findOne({ productId: product._id }).sort({ createdAt: -1 }).session(session);
        if (batch) {
          batch.availableQty += item.quantity;
          await batch.save({ session });
        }
      }
    }

    if (sale.customer) {
      await Customer.findByIdAndUpdate(
        sale.customer,
        {
          $inc: {
            totalPurchases: -1,
            totalSpent: -sale.totalAmount,
            walletBalance: -(sale.amountPaid - sale.totalAmount)
          }
        },
        { session }
      );
      await PartyLedger.deleteOne({ referenceId: sale._id }).session(session);
    }

    // Revert old Cash/Bank transactions manually
    const oldTransactions = await CashBankTransaction.find({ referenceId: sale._id, status: 'completed' }).session(session);
    for (const tx of oldTransactions) {
      if (tx.accountId) {
        const acc = await BankAccount.findById(tx.accountId).session(session);
        if (acc) {
          if (tx.direction === 'in') {
            acc.currentBalance -= tx.amount;
          } else {
            acc.currentBalance += tx.amount;
          }
          await acc.save({ session, validateBeforeSave: false });
        }
      }
    }
    await CashBankTransaction.deleteMany({ referenceId: sale._id }).session(session);

    // 2. CREATION/APPLICATION PHASE (of new sale details)
    const saleItems = [];

    // Deduct stock and validate
    for (const item of items) {
      const product = await Product.findOne({ _id: item.product, isActive: true }).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      // Check stock
      if ((product.stock || 0) < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }

      const batches = await StockBatch.find({
        productId: item.product,
        availableQty: { $gt: 0 }
      }).sort({ createdAt: 1 }).session(session);

      let remainingToDeduct = item.quantity;
      let totalPurchaseCost = 0;

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deductQty = Math.min(batch.availableQty, remainingToDeduct);
        totalPurchaseCost += deductQty * batch.purchasePrice;
        remainingToDeduct -= deductQty;
      }

      const avgPurchasePrice = item.quantity > 0 ? totalPurchaseCost / item.quantity : 0;

      await inventoryService.deductStock({
        productId: item.product,
        quantity: item.quantity,
        reference: sale.invoiceNumber,
        referenceId: sale._id,
        notes: `Updated Sale invoice ${sale.invoiceNumber}`,
        createdBy: req.user._id
      }, session);

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
      });
    }

    // Update sale fields in-place
    sale.items = saleItems;
    sale.customer = customer || undefined;
    sale.customerName = customerName || 'Walk-in Customer';
    sale.subtotal = subtotal;
    sale.taxRate = taxRate || 0;
    sale.taxAmount = taxAmount || 0;
    sale.totalCgst = totalCgst || 0;
    sale.totalSgst = totalSgst || 0;
    sale.totalIgst = totalIgst || 0;
    sale.discountType = discountType || 'fixed';
    sale.discountValue = discountValue || 0;
    sale.discountAmount = discountAmount || 0;
    sale.totalAmount = totalAmount;
    sale.paymentMethod = paymentMethod;
    sale.paymentStatus = paymentStatus || 'paid';
    sale.amountPaid = amountPaid || totalAmount;
    sale.changeAmount = changeAmount || 0;
    sale.notes = notes;
    sale.cashBankAccountId = cashBankAccountId;

    await sale.save({ session });

    // Update customer stats
    if (customer) {
      await Customer.findByIdAndUpdate(
        customer,
        {
          $inc: {
            totalPurchases: 1,
            totalSpent: totalAmount,
          },
        },
        { session }
      );

      await partyLedgerService.createEntry({
        partyId: customer,
        partyType: 'Customer',
        type: 'sale',
        debitAmount: Number(totalAmount),
        creditAmount: Number(amountPaid || 0),
        referenceId: sale._id,
        receiptNo: sale.invoiceNumber,
        notes: `Sale Invoice Updated ${sale.invoiceNumber}. Total: ₹${totalAmount}, Paid: ₹${amountPaid}`,
        date: new Date()
      }, session);
    }

    if (sale.amountPaid > 0) {
      await createCashBankTransaction({
        date: sale.createdAt || new Date(),
        type: 'sale_payment',
        direction: 'in',
        amount: sale.amountPaid,
        paymentMode: sale.paymentMethod || 'Cash',
        accountType: (sale.paymentMethod === 'Cash' || sale.paymentMethod === 'cash') ? 'cash' : 'bank',
        accountId: sale.cashBankAccountId || undefined,
        partyId: customer || undefined,
        partyType: 'Customer',
        referenceModule: 'sale_invoice',
        referenceId: sale._id,
        referenceNo: sale.invoiceNumber,
        description: `Payment received for updated Invoice ${sale.invoiceNumber}`,
        createdBy: req.user._id
      }, session);
    }

    if (session) {
      await session.commitTransaction();
    }

    // Emit live WebSocket sync
    try {
      emitSocketEvent('sale:updated', {
        _id: sale._id,
        invoiceNo: sale.invoiceNumber,
        totalAmount,
        customerName
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit sale socket event:', e);
    }

    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name phone email walletBalance')
      .populate('cashier', 'name email')
      .populate('items.product', 'name sku');

    res.status(200).json({
      success: true,
      data: populatedSale,
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};
