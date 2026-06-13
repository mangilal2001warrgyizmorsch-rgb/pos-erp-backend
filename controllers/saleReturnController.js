import mongoose from 'mongoose';
import SalesReturn from '../models/SalesReturn.js';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js';
import PartyLedger from '../models/PartyLedger.js';
import AuditLog from '../models/AuditLog.js';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { createCashBankTransaction } from '../services/cashBankTransactionService.js';
import { recordStockMovement } from '../utils/stockMovement.js';
import { inventoryService } from '../services/inventoryService.js';
import { partyLedgerService } from '../services/partyLedgerService.js';
import { postSaleReturnAccountingVoucher } from '../services/accounting/returnAccounting.service.js';
import { emitSocketEvent } from '../utils/socket.js';
import { cancelVoucher } from '../services/accounting/voucher.service.js';

const isCashPaymentMode = (paymentMode) => String(paymentMode || '').toLowerCase() === 'cash';
const sanitizeRefundAccountId = (refundType, paymentMode, accountId) => (
  refundType === 'refund_now' && !isCashPaymentMode(paymentMode) ? (accountId || null) : null
);

const returnItemAffectsInventory = (item) => item.affectsInventory !== false
  && (item.itemType || 'inventory') === 'inventory'
  && Boolean(item.product);

const findOriginalSaleItem = (sale, returnItem) => sale.items.find(
  (item) => (returnItem.saleItemId && String(item._id) === String(returnItem.saleItemId))
    || (returnItem.product && item.product && item.product.toString() === returnItem.product.toString())
);

// @desc    Create Sale Return / Credit Note
// @route   POST /api/sales-returns
export const createSaleReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerGstNo,
      billingAddress,
      originalInvoiceId,
      originalInvoiceNo,
      invoiceDate,
      returnDate,
      stateOfSupply,
      items,
      subtotal,
      totalDiscount,
      totalTax,
      roundOff,
      grandTotal,
      refundType,
      paymentMode,
      cashBankAccountId,
      referenceNo,
      notes,
    } = req.body;

    if (refundType === 'refund_now' && !paymentMode) {
      return res.status(400).json({ success: false, message: 'Payment mode is required for immediate refunds.' });
    }

    const cashBankAccountIdClean = sanitizeRefundAccountId(refundType, paymentMode, cashBankAccountId);

    // 1. Validate customer exists
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // 2. Validate original invoice exists
    const originalSale = await Sale.findById(originalInvoiceId).session(session);
    if (!originalSale) {
      throw new Error('Original invoice not found');
    }

    // 3. Validate at least one return item
    if (!items || items.length === 0) {
      throw new Error('At least one return item is required');
    }

    // 4. Validate return quantities and prepare items
    const validatedItems = [];
    let calculatedSubtotal = 0;
    let calculatedTotalTax = 0;
    let calculatedTotalDiscount = 0;

    for (const item of items) {
      // Validate return qty > 0
      if (item.returnQty <= 0) {
        throw new Error(`Return quantity must be greater than 0 for ${item.itemName}`);
      }

      // Validate return qty doesn't exceed returnable qty
      const returnableQty = item.soldQty - item.alreadyReturnedQty;
      if (item.returnQty > returnableQty) {
        throw new Error(
          `Return quantity cannot exceed returnable quantity for ${item.itemName}. Max: ${returnableQty}`
        );
      }

      // Calculate proportional discount
      const proportionalDiscount =
        (item.discountAmount / item.soldQty) * item.returnQty;

      // Calculate taxable return amount
      const returnBaseAmount = item.returnQty * item.pricePerUnit;
      const taxableReturnAmount = returnBaseAmount - proportionalDiscount;

      // Calculate tax
      const returnTaxAmount = (taxableReturnAmount * item.taxPercent) / 100;

      // Calculate item return total
      const itemReturnTotal = taxableReturnAmount + returnTaxAmount;

      calculatedSubtotal += returnBaseAmount;
      calculatedTotalDiscount += proportionalDiscount;
      calculatedTotalTax += returnTaxAmount;

      validatedItems.push({
        product: item.product,
        saleItemId: item.saleItemId,
        itemType: item.itemType || (item.product ? 'inventory' : 'non_stock_product'),
        affectsInventory: item.affectsInventory !== undefined ? Boolean(item.affectsInventory) : Boolean(item.product),
        barcode: item.barcode || '',
        itemName: item.itemName,
        soldQty: item.soldQty,
        alreadyReturnedQty: item.alreadyReturnedQty,
        returnQty: item.returnQty,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        discountAmount: proportionalDiscount,
        taxPercent: item.taxPercent,
        taxAmount: returnTaxAmount,
        returnAmount: itemReturnTotal,
        reason: item.reason || 'Other',
        stockAction: item.stockAction || 'restore_stock',
      });
    }

    // Calculate grand total
    const calculatedGrandTotal = calculatedSubtotal - calculatedTotalDiscount + calculatedTotalTax + (roundOff || 0);

    // Validate amounts match
    if (Math.abs(calculatedGrandTotal - grandTotal) > 0.01) {
      throw new Error(`Grand total mismatch. Expected: ${calculatedGrandTotal}, Got: ${grandTotal}`);
    }

    // 5. Generate atomic credit note number
    const creditNoteNo = await generateSequenceNumber('CRN');
    const returnNumber = await generateSequenceNumber('SRN');

    // 6. Create sale return record
    const saleReturn = new SalesReturn({
      creditNoteNo,
      returnNumber,
      sale: originalInvoiceId,
      invoiceNumber: originalInvoiceNo,
      invoiceDate,
      customer: customerId,
      customerName,
      customerPhone,
      customerGstNo,
      billingAddress,
      returnDate,
      stateOfSupply,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      totalDiscount: calculatedTotalDiscount,
      totalTax: calculatedTotalTax,
      roundOff: roundOff || 0,
      grandTotal: calculatedGrandTotal,
      refundMethod: refundType === 'refund_now' ? (paymentMode.toLowerCase() === 'cash' ? 'cash' : (paymentMode.toLowerCase() === 'wallet' ? 'wallet' : 'bank')) : 'credit_note',
      refundType,
      paymentMode,
      cashBankAccountId: cashBankAccountIdClean,
      refundedAmount: refundType === 'refund_now' ? calculatedGrandTotal : 0,
      creditBalance: refundType !== 'refund_now' ? calculatedGrandTotal : 0,
      referenceNo,
      status: 'issued',
      notes,
      cashier: req.user._id,
      createdBy: req.user._id,
    });

    // 7. Process stock returns using transaction-safe inventoryService
    for (const item of validatedItems) {
      if (returnItemAffectsInventory(item) && item.stockAction === 'restore_stock') {
        await inventoryService.restoreStock({
          productId: item.product,
          quantity: item.returnQty,
          reference: creditNoteNo,
          referenceId: saleReturn._id,
          notes: `Sale Return via Credit Note ${creditNoteNo}`,
          createdBy: req.user._id
        }, session);
      } else if (returnItemAffectsInventory(item)) {
        // Log movement for damaged returns without increasing available sales inventory
        const product = await Product.findById(item.product).session(session);
        if (product) {
          await recordStockMovement({
            productId: item.product,
            productName: item.itemName,
            type: 'return',
            quantity: item.returnQty,
            previousStock: product.stock,
            newStock: product.stock,
            reference: creditNoteNo,
            referenceId: saleReturn._id,
            notes: 'Damaged Sale Return (Unrestored)',
            createdBy: req.user._id,
          }, session);
        }
      }
    }

    // 8. Update original sale invoice return status
    for (const item of validatedItems) {
      const originalItem = findOriginalSaleItem(originalSale, item);
      if (originalItem) {
        originalItem.returnedQty = (originalItem.returnedQty || 0) + item.returnQty;
      }
    }
    const hasReturnedItems = originalSale.items.some((i) => (i.returnedQty || 0) > 0);
    const allItemsReturned = originalSale.items.length > 0
      && originalSale.items.every((i) => (i.returnedQty || 0) >= i.quantity);
    originalSale.returnStatus = allItemsReturned
      ? 'fully_returned'
      : hasReturnedItems
        ? 'partially_returned'
        : 'not_returned';
    await originalSale.save({ session, validateBeforeSave: false });

    // 9. Handle refund and double-entry alignments via partyLedgerService
    let ledgerDebit = 0;
    let ledgerCredit = calculatedGrandTotal;

    if (refundType === 'refund_now' && paymentMode) {
      const accountType = paymentMode === 'Cash' ? 'cash' : 'bank';

      // Create cash/bank transaction and update balance using central service
      await createCashBankTransaction({
        date: returnDate || new Date(),
        type: 'sale_return_refund',
        direction: 'out',
        amount: calculatedGrandTotal,
        paymentMode,
        accountType,
        accountId: cashBankAccountIdClean || undefined,
        partyId: customerId,
        partyType: 'Customer',
        referenceModule: 'sale_return',
        referenceId: saleReturn._id,
        referenceNo: creditNoteNo,
        description: `Refund for credit note ${creditNoteNo}`,
        createdBy: req.user._id
      }, session);

      saleReturn.status = 'refunded';
      ledgerDebit = calculatedGrandTotal; // Cash refund offsets the credit return immediately
    } else if (refundType === 'keep_as_credit') {
      saleReturn.status = 'adjusted';
      ledgerDebit = 0; // Stays as a credit balance on customer's account
    }

    // Call the central partyLedgerService which updates customer.walletBalance atomically, computes chronological balanceAfter, and broadcasts real-time WebSockets!
    await partyLedgerService.createEntry({
      partyId: customerId,
      partyType: 'Customer',
      type: 'return',
      debitAmount: ledgerDebit,
      creditAmount: ledgerCredit,
      referenceId: saleReturn._id,
      receiptNo: creditNoteNo,
      notes: `Credit Note ${creditNoteNo} for Sale Return of Invoice ${originalInvoiceNo}. Refund type: ${refundType}`,
      date: returnDate || new Date()
    }, session);

    await postSaleReturnAccountingVoucher(saleReturn, {
      session,
      createdBy: req.user._id,
      source: 'sale_return',
    });

    // 11. Save sale return
    await saleReturn.save({ session });

    // 12. Create audit log
    if (AuditLog) {
      await AuditLog.create(
        [
          {
            user: req.user._id,
            userName: req.user.name || 'System',
            action: 'create',
            module: 'SalesReturn',
            description: `Created credit note ${creditNoteNo} for invoice ${originalInvoiceNo}`,
            details: { saleReturnId: saleReturn._id },
            ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
          },
        ],
        { session }
      );
    }

    // 13. Commit transaction
    if (session) {
      await session.commitTransaction();
    }

    const populatedReturn = await SalesReturn.findById(saleReturn._id)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name email')
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
      .populate('items.product', 'name sku');

    emitSocketEvent('salesReturn:created', populatedReturn);

    res.status(201).json({
      success: true,
      data: populatedReturn,
      message: `Credit note ${creditNoteNo} created successfully`,
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

// @desc    Get all Sale Returns / Credit Notes
// @route   GET /api/sales-returns
export const getSaleReturns = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      customerId,
      status,
      paymentMode,
      refundType,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { creditNoteNo: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate) query.returnDate.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (customerId) query.customer = customerId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;
    if (refundType) query.refundType = refundType;

    const total = await SalesReturn.countDocuments(query);
    const returns = await SalesReturn.find(query)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name')
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
      .sort('-returnDate')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: returns,
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

// @desc    Get single Sale Return / Credit Note
// @route   GET /api/sales-returns/:id
export const getSaleReturn = async (req, res, next) => {
  try {
    const saleReturn = await SalesReturn.findById(req.params.id)
      .populate('customer', 'name phone email address gstNumber')
      .populate('cashier', 'name email')
      .populate('accountingVoucherId', 'voucherNo date status totalDebit totalCredit')
      .populate('items.product', 'name sku image');

    if (!saleReturn) {
      return res.status(404).json({
        success: false,
        message: 'Sale return not found',
      });
    }

    res.status(200).json({
      success: true,
      data: saleReturn,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Sale Return / Credit Note
// @route   PUT /api/sales-returns/:id
export const updateSaleReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const saleReturn = await SalesReturn.findById(req.params.id).session(session);

    if (!saleReturn) {
      throw new Error('Sale return not found');
    }

    if (saleReturn.status !== 'draft') {
      throw new Error('Only draft sale returns can be updated');
    }

    // Update allowed fields
    const updateFields = [
      'refundType',
      'paymentMode',
      'cashBankAccountId',
      'referenceNo',
      'notes',
    ];

    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        saleReturn[field] = req.body[field];
      }
    }

    await saleReturn.save({ session });
    if (session) {
      await session.commitTransaction();
    }

    const updated = await SalesReturn.findById(saleReturn._id)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name email')
      .populate('items.product', 'name sku');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Sale return updated successfully',
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

// @desc    Cancel Sale Return / Credit Note
// @route   POST /api/sales-returns/:id/cancel
export const cancelSaleReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const saleReturn = await SalesReturn.findById(req.params.id).session(session);

    if (!saleReturn) {
      throw new Error('Sale return not found');
    }

    if (saleReturn.status === 'cancelled') {
      throw new Error('Sale return is already cancelled');
    }

    // Reverse stock movements
    for (const item of saleReturn.items) {
      if (!returnItemAffectsInventory(item)) continue;

      const product = await Product.findById(item.product).session(session);
      if (product) {
        if (item.stockAction === 'restore_stock') {
          product.stock -= item.returnQty;
        }
        await product.save({ session });

        if (item.stockAction === 'restore_stock') {
          const batch = await StockBatch.findOne({ productId: product._id }).sort({ createdAt: -1 }).session(session);
          if (batch) {
            batch.availableQty = Math.max(0, Number(batch.availableQty || 0) - Number(item.returnQty || 0));
            await batch.save({ session });
          }
        }
      }
    }

    // Reverse original invoice return status
    const originalSale = await Sale.findById(saleReturn.sale).session(session);
    if (originalSale) {
      for (const item of saleReturn.items) {
        const originalItem = findOriginalSaleItem(originalSale, item);
        if (originalItem) {
          originalItem.returnedQty = Math.max(0, (originalItem.returnedQty || 0) - item.returnQty);
        }
      }
      const hasReturnedItems = originalSale.items.some((i) => (i.returnedQty || 0) > 0);
      const allItemsReturned = originalSale.items.length > 0
        && originalSale.items.every((i) => (i.returnedQty || 0) >= i.quantity);
      originalSale.returnStatus = allItemsReturned
        ? 'fully_returned'
        : hasReturnedItems
          ? 'partially_returned'
          : 'not_returned';
      await originalSale.save({ session, validateBeforeSave: false });
    }

    // Reverse cash/bank transactions and remove their completed movement rows
    const cashTransactions = await CashBankTransaction.find({ referenceId: saleReturn._id, status: 'completed' }).session(session);
    for (const tx of cashTransactions) {
      if (tx.accountId) {
        const bankAccount = await BankAccount.findById(tx.accountId).session(session);
        if (bankAccount) {
          if (tx.direction === 'in') {
            bankAccount.currentBalance -= tx.amount;
          } else {
            bankAccount.currentBalance += tx.amount;
          }
          await bankAccount.save({ session, validateBeforeSave: false });
        }
      }
    }
    await CashBankTransaction.deleteMany({ referenceId: saleReturn._id }).session(session);

    // Reverse credit balance
    const customer = await Customer.findById(saleReturn.customer).session(session);
    if (customer && saleReturn.creditBalance > 0) {
      customer.walletBalance = (customer.walletBalance || 0) - saleReturn.creditBalance;
      await customer.save({ session, validateBeforeSave: false });
    }
    await PartyLedger.deleteMany({ referenceId: saleReturn._id }).session(session);

    saleReturn.status = 'cancelled';
    await saleReturn.save({ session });

    if (saleReturn.accountingVoucherId) {
      await cancelVoucher(saleReturn.accountingVoucherId, `Sale return ${saleReturn.creditNoteNo} cancelled`, req.user._id, { session });
      saleReturn.accountingVoucherId = undefined;
      saleReturn.accountingPosted = false;
      saleReturn.accountingStatus = 'not_posted';
      saleReturn.accountingError = '';
      await saleReturn.save({ session, validateBeforeSave: false });
    }

    if (session) {
      await session.commitTransaction();
    }

    res.status(200).json({
      success: true,
      data: saleReturn,
      message: 'Sale return cancelled successfully',
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

// @desc    Delete Sale Return / Credit Note
// @route   DELETE /api/sales-returns/:id
export const deleteSaleReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const saleReturn = await SalesReturn.findById(req.params.id).session(session);

    if (!saleReturn) {
      return res.status(404).json({ success: false, message: 'Sale return not found' });
    }

    // 1. Reverse stock movements
    for (const item of saleReturn.items) {
      if (!returnItemAffectsInventory(item)) continue;

      const product = await Product.findById(item.product).session(session);
      if (product) {
        if (item.stockAction === 'restore_stock') {
          // Reduce the stock back to what it was before the return
          product.stock -= item.returnQty;
          await product.save({ session });
          
          // Reverse the batch quantities
          let batch = await StockBatch.findOne({ productId: product._id }).sort({ createdAt: -1 }).session(session);
          if (batch) {
            batch.availableQty = Math.max(0, Number(batch.availableQty || 0) - Number(item.returnQty || 0));
            await batch.save({ session });
          }
        }
      }
    }

    // 2. Reverse original invoice return status
    const originalSale = await Sale.findById(saleReturn.sale).session(session);
    if (originalSale) {
      for (const item of saleReturn.items) {
        const originalItem = findOriginalSaleItem(originalSale, item);
        if (originalItem) {
          originalItem.returnedQty = Math.max(0, (originalItem.returnedQty || 0) - item.returnQty);
        }
      }
      const hasReturnedItems = originalSale.items.some((i) => (i.returnedQty || 0) > 0);
      const allItemsReturned = originalSale.items.length > 0
        && originalSale.items.every((i) => (i.returnedQty || 0) >= i.quantity);
      originalSale.returnStatus = allItemsReturned
        ? 'fully_returned'
        : hasReturnedItems
          ? 'partially_returned'
          : 'not_returned';
      await originalSale.save({ session, validateBeforeSave: false });
    }

    // 3. Reverse cash/bank transactions and update balances
    const cashTransactions = await CashBankTransaction.find({ referenceId: saleReturn._id, status: 'completed' }).session(session);
    for (const tx of cashTransactions) {
      if (tx.accountId) {
        const bankAccount = await BankAccount.findById(tx.accountId).session(session);
        if (bankAccount) {
          if (tx.direction === 'in') {
            bankAccount.currentBalance -= tx.amount;
          } else {
            bankAccount.currentBalance += tx.amount;
          }
          await bankAccount.save({ session, validateBeforeSave: false });
        }
      }
    }
    await CashBankTransaction.deleteMany({ referenceId: saleReturn._id }).session(session);

    // 4. Reverse customer wallet/credit balance and delete party ledger entry
    const customer = await Customer.findById(saleReturn.customer).session(session);
    if (customer) {
      if (saleReturn.creditBalance > 0) {
        customer.walletBalance = (customer.walletBalance || 0) - saleReturn.creditBalance;
      }
      if (saleReturn.refundedAmount > 0) {
        customer.totalSpent = (customer.totalSpent || 0) - saleReturn.grandTotal;
      }
      await customer.save({ session, validateBeforeSave: false });
    }
    await PartyLedger.deleteMany({ referenceId: saleReturn._id }).session(session);

    // 5. Delete the sale return document
    if (saleReturn.accountingVoucherId) {
      await cancelVoucher(saleReturn.accountingVoucherId, `Sale return ${saleReturn.creditNoteNo} deleted`, req.user._id, { session });
    }

    await SalesReturn.findByIdAndDelete(saleReturn._id).session(session);

    if (session) {
      await session.commitTransaction();
    }

    // Broadcast WebSocket update
    try {
      emitSocketEvent('salesReturn:deleted', { _id: saleReturn._id });
    } catch (e) {
      console.error('[Socket Sync] Failed to emit event:', e);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Sale return deleted and all related transactions reversed successfully' 
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};

// @desc    Get unreturned sales for a customer
// @route   GET /api/sales/customer/:customerId/unreturned
export const getUnreturnedSalesForCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const sales = await Sale.find({
      customer: customerId,
      status: { $ne: 'cancelled' },
      returnStatus: { $ne: 'fully_returned' },
    })
      .populate('customer', 'name phone email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get returnable items from a sale invoice
// @route   GET /api/sales/:id/returnable-items
export const getReturnableItemsFromSale = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id).populate('items.product');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    // Get already returned items for this sale
    const returnedItems = await SalesReturn.find({
      sale: id,
      status: { $ne: 'cancelled' },
    });

    const returnedMap = {};
    for (const returnRecord of returnedItems) {
      for (const item of returnRecord.items) {
        const key = item.saleItemId?.toString() || item.product?.toString();
        if (!key) continue;
        returnedMap[key] = (returnedMap[key] || 0) + item.returnQty;
      }
    }

    // Calculate returnable items
    const returnableItems = sale.items.map((item) => {
      const saleItemKey = item._id?.toString();
      const productKey = item.product?._id?.toString();
      const alreadyReturnedQty = returnedMap[saleItemKey] || returnedMap[productKey] || 0;
      const affectsInventory = item.affectsInventory !== false && (item.itemType || 'inventory') === 'inventory' && Boolean(item.product);
      return {
        product: item.product?._id,
        saleItemId: item._id,
        itemType: item.itemType || 'inventory',
        affectsInventory,
        itemName: item.itemName || item.name,
        barcode: item.sku,
        soldQty: item.quantity,
        alreadyReturnedQty,
        returnableQty: item.quantity - alreadyReturnedQty,
        unit: 'piece',
        pricePerUnit: item.unitPrice,
        discountAmount: sale.subtotal ? (sale.discountAmount / sale.subtotal) * (item.unitPrice * item.quantity) : 0,
        taxPercent: item.taxRate || 0,
        stockAction: affectsInventory ? 'restore_stock' : 'no_stock',
        reason: 'Other',
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sale: {
          invoiceNo: sale.invoiceNumber,
          invoiceDate: sale.createdAt,
          customerName: sale.customerName,
          customerId: sale.customer,
        },
        items: returnableItems,
      },
    });
  } catch (error) {
    next(error);
  }
};
