import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import StockBatch from '../models/StockBatch.js';
import StockMovement from '../models/StockMovement.js';
import PartyLedger from '../models/PartyLedger.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';
import SalesPrice from '../models/SalesPrice.js';
import { inventoryService } from '../services/inventoryService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { emitSocketEvent } from '../utils/socket.js';
import { recordStockMovement } from '../utils/stockMovement.js';
import { markPurchaseAccountingFailure, postPurchaseAccountingVoucher } from '../services/accounting/purchaseAccounting.service.js';
import { ensureSupplierAccountingLedger } from '../services/accounting/partyAccountingLedger.service.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';

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
      purchaseDate,
      stateOfSupply,
      subtotal,
      taxRate,
      taxAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      discountAmount,
      shippingCharges,
      roundOff,
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
      purchaseDate: purchaseDate || Date.now(),
      stateOfSupply,
      subtotal,
      taxRate: taxRate || 0,
      taxAmount: taxAmount || 0,
      totalCgst: totalCgst || 0,
      cgstAmount: totalCgst || 0,
      totalSgst: totalSgst || 0,
      sgstAmount: totalSgst || 0,
      totalIgst: totalIgst || 0,
      igstAmount: totalIgst || 0,
      taxableAmount: Number(subtotal || 0) - Number(discountAmount || 0),
      totalTax: taxAmount || 0,
      discountAmount: discountAmount || 0,
      shippingCharges: shippingCharges || 0,
      roundOff: roundOff || 0,
      totalAmount,
      grandTotal: totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      amountPaid: amountPaid ?? totalAmount,
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
        gstRate: item.gstRate || item.taxRate || 0,
        taxableAmount: item.taxableAmount ?? (Number(item.purchasePrice || 0) * Number(item.quantity || 0)),
        cgstAmount: item.cgstAmount ?? item.cgst ?? 0,
        sgstAmount: item.sgstAmount ?? item.sgst ?? 0,
        igstAmount: item.igstAmount ?? item.igst ?? 0,
        taxAmount: item.taxAmount ?? (Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0)),
        hsn: item.hsn || item.hsnCode,
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
      await ensureSupplierAccountingLedger(supplier, session, req.user._id);

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

    await postPurchaseAccountingVoucher(purchase, {
      session,
      createdBy: req.user._id,
      source: 'create_purchase',
    });

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
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
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
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
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

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
export const deletePurchase = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    const confirmedReceipt = purchase.status === 'confirmed' || purchase.status === 'received';

    if (confirmedReceipt) {
      // Revert product stocks
      for (const item of purchase.items) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          const previousStock = product.stock || 0;
          const newStock = previousStock - item.quantity;
          product.stock = newStock;
          await product.save({ session });

          await recordStockMovement({
            productId: product._id,
            productName: product.name,
            type: 'cancellation',
            quantity: -item.quantity,
            previousStock,
            newStock,
            reference: purchase.purchaseNumber,
            referenceId: purchase._id,
            notes: 'Purchase deleted',
            createdBy: req.user._id,
          }, session);
        }
      }

      // Delete associated StockBatch and SalesPrice documents
      await StockBatch.deleteMany({ purchaseId: purchase._id }).session(session);
      await SalesPrice.deleteMany({ purchaseId: purchase._id }).session(session);

      // Revert Supplier totalPurchases, outstanding balance, and ledger
      if (purchase.supplier) {
        await Supplier.findByIdAndUpdate(
          purchase.supplier,
          {
            $inc: {
              totalPurchases: -purchase.totalAmount,
              outstandingBalance: -(purchase.totalAmount - purchase.amountPaid)
            }
          },
          { session }
        );
        await PartyLedger.deleteOne({ referenceId: purchase._id }).session(session);
      }

      // Revert old Cash/Bank transactions manually to restore account balances
      const oldTransactions = await CashBankTransaction.find({ referenceId: purchase._id, status: 'completed' }).session(session);
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
      await CashBankTransaction.deleteMany({ referenceId: purchase._id }).session(session);
    }

    if (purchase.accountingVoucherId) {
      await cancelVoucher(purchase.accountingVoucherId, `Purchase ${purchase.purchaseNumber} deleted`, req.user._id, { session });
    }

    await Purchase.findByIdAndDelete(purchase._id).session(session);

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast live WebSocket update
    try {
      emitSocketEvent('purchase:deleted', { _id: purchase._id });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit purchase event:', e);
    }

    res.status(200).json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};

// @desc    Update purchase
// @route   PUT /api/purchases/:id
export const updatePurchase = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    const previousAccountingVoucherId = purchase.accountingVoucherId;

    const {
      items,
      supplier,
      transporter,
      invoiceNumber,
      purchaseDate,
      stateOfSupply,
      subtotal,
      taxRate,
      taxAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      discountAmount,
      shippingCharges,
      roundOff,
      totalAmount,
      paymentMethod,
      paymentStatus,
      amountPaid,
      status,
      notes,
      cashBankAccountId,
    } = req.body;

    const oldConfirmedReceipt = purchase.status === 'confirmed' || purchase.status === 'received';

    // 1. REVERSAL PHASE (of old purchase)
    if (oldConfirmedReceipt) {
      for (const item of purchase.items) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          product.stock = (product.stock || 0) - item.quantity;
          await product.save({ session });
        }
      }
      await StockBatch.deleteMany({ purchaseId: purchase._id }).session(session);
      await SalesPrice.deleteMany({ purchaseId: purchase._id }).session(session);

      if (purchase.supplier) {
        await Supplier.findByIdAndUpdate(
          purchase.supplier,
          {
            $inc: {
              totalPurchases: -purchase.totalAmount,
              outstandingBalance: -(purchase.totalAmount - purchase.amountPaid)
            }
          },
          { session }
        );
        await PartyLedger.deleteOne({ referenceId: purchase._id }).session(session);
      }

      // Revert old Cash/Bank transactions manually to restore account balances
      const oldTransactions = await CashBankTransaction.find({ referenceId: purchase._id, status: 'completed' }).session(session);
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
      await CashBankTransaction.deleteMany({ referenceId: purchase._id }).session(session);
    }

    // 2. CREATION/APPLICATION PHASE (of new payload)
    const finalItems = [];
    const newConfirmedReceipt = status === 'confirmed' || status === 'received';
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
        gstRate: item.gstRate || item.taxRate || 0,
        taxableAmount: item.taxableAmount ?? (Number(item.purchasePrice || 0) * Number(item.quantity || 0)),
        cgstAmount: item.cgstAmount ?? item.cgst ?? 0,
        sgstAmount: item.sgstAmount ?? item.sgst ?? 0,
        igstAmount: item.igstAmount ?? item.igst ?? 0,
        taxAmount: item.taxAmount ?? (Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0)),
        hsn: item.hsn || item.hsnCode,
      });

      if (newConfirmedReceipt) {
        const batchNo = item.batchNo || `BATCH-${Date.now()}-${productId.toString().slice(-4)}`;

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
          reference: purchase.purchaseNumber,
          notes: `Purchase receipt updated: ${purchase.purchaseNumber}`,
          createdBy: req.user._id
        }, session);

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

    // Update the purchase record in-place
    purchase.items = finalItems;
    purchase.supplier = supplier;
    purchase.transporter = transporter || undefined;
    purchase.invoiceNumber = invoiceNumber;
    purchase.purchaseDate = purchaseDate || purchase.createdAt || Date.now();
    purchase.stateOfSupply = stateOfSupply;
    purchase.subtotal = subtotal;
    purchase.taxRate = taxRate || 0;
    purchase.taxAmount = taxAmount || 0;
    purchase.totalCgst = totalCgst || 0;
    purchase.cgstAmount = totalCgst || 0;
    purchase.totalSgst = totalSgst || 0;
    purchase.sgstAmount = totalSgst || 0;
    purchase.totalIgst = totalIgst || 0;
    purchase.igstAmount = totalIgst || 0;
    purchase.taxableAmount = Number(subtotal || 0) - Number(discountAmount || 0);
    purchase.totalTax = taxAmount || 0;
    purchase.discountAmount = discountAmount || 0;
    purchase.shippingCharges = shippingCharges || 0;
    purchase.roundOff = roundOff || 0;
    purchase.totalAmount = totalAmount;
    purchase.grandTotal = totalAmount;
    purchase.paymentMethod = paymentMethod;
    purchase.paymentStatus = paymentStatus || 'paid';
    purchase.amountPaid = amountPaid ?? totalAmount;
    purchase.status = status || 'confirmed';
    purchase.notes = notes;
    purchase.cashBankAccountId = cashBankAccountId;

    await purchase.save({ session });

    if (supplier && newConfirmedReceipt) {
      await ensureSupplierAccountingLedger(supplier, session, req.user._id);

      await Supplier.findByIdAndUpdate(
        supplier,
        {
          $inc: {
            totalPurchases: totalAmount,
          },
        },
        { session }
      );

      await partyLedgerService.createEntry({
        partyId: supplier,
        partyType: 'Supplier',
        type: 'purchase',
        creditAmount: Number(totalAmount),
        debitAmount: Number(amountPaid || 0),
        referenceId: purchase._id,
        receiptNo: purchase.purchaseNumber,
        notes: `Purchase Bill Updated ${purchase.purchaseNumber}. Total: ₹${totalAmount}, Paid: ₹${amountPaid}`,
        date: new Date()
      }, session);
    }

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
        referenceNo: purchase.purchaseNumber,
        description: `Payment made for updated Purchase bill ${purchase.purchaseNumber}`,
        createdBy: req.user._id
      }, session);
    }

    if (previousAccountingVoucherId) {
      await cancelVoucher(previousAccountingVoucherId, `Purchase ${purchase.purchaseNumber} updated`, req.user._id, { session });
      purchase.accountingVoucherId = undefined;
      purchase.accountingPosted = false;
      purchase.accountingStatus = 'not_posted';
      purchase.accountingError = '';
      await purchase.save({ session, validateBeforeSave: false });
    }

    await postPurchaseAccountingVoucher(purchase, {
      session,
      createdBy: req.user._id,
      source: 'update_purchase',
    });

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast live WebSocket update
    try {
      emitSocketEvent('purchase:updated', {
        _id: purchase._id,
        purchaseNo: purchase.purchaseNumber,
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
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
      .populate('items.product', 'name sku');

    res.status(200).json({
      success: true,
      data: populatedPurchase,
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};
