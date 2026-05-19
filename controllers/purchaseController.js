import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import StockBatch from '../models/StockBatch.js';
import StockMovement from '../models/StockMovement.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { createCashBankTransaction } from '../services/cashBankTransactionService.js';
import SalesPrice from '../models/SalesPrice.js';
import { inventoryService } from '../services/inventoryService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { emitSocketEvent } from '../utils/socket.js';

export const createPurchase = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const {
      items,
      supplier,
      transporter,
      invoiceNumber,
      subtotal,
      taxRate,
      taxAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      discountAmount,
      shippingCharges,
      totalAmount,
      paymentMethod,
      paymentStatus,
      amountPaid,
      status,
      notes,
      cashBankAccountId,
    } = req.body;

    const purchaseNumber = await generateSequenceNumber('PUR', session);

    // Instantiate Purchase record
    const purchase = new Purchase({
      purchaseNumber,
      items: [], // We'll populate this
      supplier,
      transporter: transporter || undefined,
      invoiceNumber,
      subtotal,
      taxRate: taxRate || 0,
      taxAmount: taxAmount || 0,
      totalCgst: totalCgst || 0,
      totalSgst: totalSgst || 0,
      totalIgst: totalIgst || 0,
      discountAmount: discountAmount || 0,
      shippingCharges: shippingCharges || 0,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      amountPaid: amountPaid || totalAmount,
      status: status || 'confirmed',
      notes,
      cashBankAccountId,
      createdBy: req.user._id,
    });

    const finalItems = [];
    const confirmedReceipt = purchase.status === 'confirmed' || purchase.status === 'received';
    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const shippingPerItem = totalQty > 0 ? (shippingCharges || 0) / totalQty : 0;

    for (const item of items) {
      let productId = item.product;

      // Inline product creation if new
      if (item.isNewProduct && item.newProductData) {
        const newProd = new Product({
          ...item.newProductData,
          stock: 0,
        });
        await newProd.save({ session });
        productId = newProd._id;
      }

      finalItems.push({
        ...item,
        product: productId,
      });

      if (confirmedReceipt) {
        const batchNo = item.batchNo || `BATCH-${Date.now()}-${productId.toString().slice(-4)}`;

        // Call inventoryService.addStock to create batch, add Product.stock, and save StockMovement record inside the session
        const { batch } = await inventoryService.addStock({
          productId,
          purchaseId: purchase._id,
          batchNo,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice || 0,
          taxPercent: item.taxRate || 0,
          discountPercent: item.discount || 0,
          extraChargePerProduct: shippingPerItem,
          salePrice: item.salesPrice || 0,
          expiryDate: item.expiryDate,
          barcode: item.barcode,
          reference: purchaseNumber,
          notes: `Purchase receipt: ${purchaseNumber}`,
          createdBy: req.user._id
        }, session);

        // SalesPrice Entry for billing strategies
        await SalesPrice.create([{
          productId: productId,
          purchaseId: purchase._id,
          batchId: batch._id,
          barcode: item.barcode || productId.toString(),
          purchasePrice: item.purchasePrice || 0,
          taxPercent: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
          discountPercent: item.discount || 0,
          discountAmount: item.discountAmount || 0,
          extraCharges: shippingCharges || 0,
          extraChargePerProduct: shippingPerItem,
          calculatedSalePrice: item.salesPrice || 0,
          availableQty: item.quantity,
          pricingStatus: 'active',
        }], { session });
      }
    }

    purchase.items = finalItems;
    await purchase.save({ session });

    // Update supplier balance and statements if supplier exists
    if (supplier && confirmedReceipt) {
      await Supplier.findByIdAndUpdate(
        supplier,
        {
          $inc: {
            totalPurchases: totalAmount,
          },
        },
        { session }
      );

      // Create double-entry Party Ledger entry for all purchases associated with a supplier
      await partyLedgerService.createEntry({
        partyId: supplier,
        partyType: 'Supplier',
        type: 'purchase',
        creditAmount: Number(totalAmount),
        debitAmount: Number(amountPaid || 0),
        referenceId: purchase._id,
        receiptNo: purchaseNumber,
        notes: `Purchase Bill ${purchaseNumber}. Total: ₹${totalAmount}, Paid: ₹${amountPaid}`,
        date: new Date()
      }, session);
    }

    // Log payment in central Cash/Bank transaction log if paid
    if (purchase.amountPaid > 0) {
      await createCashBankTransaction({
        date: purchase.createdAt || new Date(),
        type: 'purchase_payment',
        direction: 'out',
        amount: purchase.amountPaid,
        paymentMode: purchase.paymentMethod || 'Cash',
        accountType: (purchase.paymentMethod === 'Cash' || purchase.paymentMethod === 'cash') ? 'cash' : 'bank',
        accountId: purchase.cashBankAccountId || undefined,
        partyId: supplier || undefined,
        partyType: 'Supplier',
        referenceModule: 'purchase_bill',
        referenceId: purchase._id,
        referenceNo: purchaseNumber,
        description: `Payment made for Purchase bill ${purchaseNumber}`,
        createdBy: req.user._id
      }, session);
    }

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast live WebSocket update
    try {
      emitSocketEvent('purchase:created', {
        _id: purchase._id,
        purchaseNo: purchaseNumber,
        totalAmount,
        supplierId: supplier
      });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit purchase event:', e);
    }

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name mobile gstNumber outstandingBalance')
      .populate('transporter', 'name vehicleNumber')
      .populate('createdBy', 'name email')
      .populate('items.product', 'name sku');

    res.status(201).json({
      success: true,
      data: populatedPurchase,
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
      .populate('supplier', 'name phone')
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
      .populate('supplier', 'name phone address gstNumber')
      .populate('transporter', 'name phone vehicleNumber')
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
// @desc    Get unpaid purchases for a supplier
// @route   GET /api/purchases/unpaid/:supplierId
export const getUnpaidPurchases = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const purchases = await Purchase.find({
      supplier: supplierId,
      paymentStatus: { $ne: 'paid' },
      status: { $ne: 'cancelled' }
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};
