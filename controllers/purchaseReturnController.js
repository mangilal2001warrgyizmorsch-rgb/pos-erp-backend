import mongoose from 'mongoose';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
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
import { emitSocketEvent } from '../utils/socket.js';

// @desc    Create Purchase Return / Debit Note
// @route   POST /api/purchases-returns
export const createPurchaseReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const {
      supplierId,
      supplierName,
      supplierPhone,
      supplierGstNo,
      address,
      originalPurchaseId,
      originalPurchaseNo,
      billDate,
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

    // 1. Validate supplier exists
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // 2. Validate original purchase exists
    const originalPurchase = await Purchase.findById(originalPurchaseId).session(session);
    if (!originalPurchase) {
      throw new Error('Original purchase bill not found');
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
      const returnableQty = item.purchasedQty - item.alreadyReturnedQty;
      if (item.returnQty > returnableQty) {
        throw new Error(
          `Return quantity cannot exceed returnable quantity for ${item.itemName}. Max: ${returnableQty}`
        );
      }

      // Validate stock availability
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.itemName}`);
      }

      if (product.stock < item.returnQty) {
        throw new Error(
          `Insufficient stock for ${item.itemName}. Available: ${product.stock}, Required: ${item.returnQty}`
        );
      }

      // Calculate proportional discount
      const proportionalDiscount =
        (item.discountAmount / item.purchasedQty) * item.returnQty;

      // Calculate taxable return amount
      const returnBaseAmount = item.returnQty * item.purchasePrice;
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
        barcode: item.barcode || '',
        itemName: item.itemName,
        purchasedQty: item.purchasedQty,
        alreadyReturnedQty: item.alreadyReturnedQty,
        returnQty: item.returnQty,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        discountAmount: proportionalDiscount,
        taxPercent: item.taxPercent,
        taxAmount: returnTaxAmount,
        returnAmount: itemReturnTotal,
        reason: item.reason || 'Other',
      });
    }

    // Calculate grand total
    const calculatedGrandTotal = calculatedSubtotal - calculatedTotalDiscount + calculatedTotalTax + (roundOff || 0);

    // Validate amounts match
    if (Math.abs(calculatedGrandTotal - grandTotal) > 0.01) {
      throw new Error(`Grand total mismatch. Expected: ${calculatedGrandTotal}, Got: ${grandTotal}`);
    }

    // 5. Generate atomic debit note number
    const debitNoteNo = await generateSequenceNumber('DBN');
    const returnNumber = await generateSequenceNumber('PRN');

    // 6. Create purchase return record
    const purchaseReturn = new PurchaseReturn({
      debitNoteNo,
      returnNumber,
      purchase: originalPurchaseId,
      purchaseNumber: originalPurchaseNo,
      billDate,
      supplier: supplierId,
      supplierName,
      supplierPhone,
      supplierGstNo,
      address,
      returnDate,
      stateOfSupply,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      totalDiscount: calculatedTotalDiscount,
      totalTax: calculatedTotalTax,
      roundOff: roundOff || 0,
      grandTotal: calculatedGrandTotal,
      refundMethod: refundType === 'refund_received' ? (paymentMode.toLowerCase() === 'cash' ? 'cash' : 'bank') : 'vendor_credit',
      refundType,
      paymentMode,
      cashBankAccountId: refundType === 'refund_received' ? cashBankAccountId : null,
      refundReceivedAmount: refundType === 'refund_received' ? calculatedGrandTotal : 0,
      debitBalance: refundType !== 'refund_received' ? calculatedGrandTotal : 0,
      referenceNo,
      status: 'issued',
      notes,
      createdBy: req.user._id,
    });

    // 7. Process stock returns using transaction-safe inventoryService
    for (const item of validatedItems) {
      await inventoryService.deductStock({
        productId: item.product,
        quantity: item.returnQty,
        reference: debitNoteNo,
        referenceId: purchaseReturn._id,
        notes: `Purchase Return via Debit Note ${debitNoteNo} - ${item.reason || 'Supplier return'}`,
        createdBy: req.user._id
      }, session);
    }

    // 8. Update original purchase bill return status
    originalPurchase.returnStatus = 'partially_returned';
    for (const item of validatedItems) {
      const originalItem = originalPurchase.items.find(
        (i) => i.product.toString() === item.product.toString()
      );
      if (originalItem) {
        originalItem.returnedQty = (originalItem.returnedQty || 0) + item.returnQty;
        if (originalItem.returnedQty >= originalItem.quantity) {
          originalPurchase.returnStatus = 'fully_returned';
        }
      }
    }
    await originalPurchase.save({ session, validateBeforeSave: false });

    // 9. Handle refund and double-entry alignments via partyLedgerService
    let ledgerDebit = calculatedGrandTotal;
    let ledgerCredit = 0;

    if (refundType === 'refund_received' && paymentMode) {
      const accountType = paymentMode === 'Cash' ? 'cash' : 'bank';

      // Create cash/bank transaction and update balance using central service
      await createCashBankTransaction({
        date: returnDate || new Date(),
        type: 'purchase_return_refund',
        direction: 'in',
        amount: calculatedGrandTotal,
        paymentMode,
        accountType,
        accountId: cashBankAccountId || undefined,
        partyId: supplierId,
        partyType: 'Supplier',
        referenceModule: 'purchase_return',
        referenceId: purchaseReturn._id,
        referenceNo: debitNoteNo,
        description: `Refund received for debit note ${debitNoteNo}`,
        createdBy: req.user._id
      }, session);

      purchaseReturn.status = 'refunded';
      ledgerCredit = calculatedGrandTotal; // Cash refund received offsets the debit return immediately
    } else if (refundType === 'keep_as_debit') {
      purchaseReturn.status = 'adjusted';
      ledgerCredit = 0; // Stays as a debit balance / decrementing supplier outstanding payables
    }

    // Call the central partyLedgerService which updates supplier.outstandingBalance atomically, computes balanceAfter, and broadcasts real-time WebSockets!
    await partyLedgerService.createEntry({
      partyId: supplierId,
      partyType: 'Supplier',
      type: 'return',
      debitAmount: ledgerDebit,
      creditAmount: ledgerCredit,
      referenceId: purchaseReturn._id,
      receiptNo: debitNoteNo,
      notes: `Debit Note ${debitNoteNo} for Purchase Return of Bill ${originalPurchaseNo}. Refund type: ${refundType}`,
      date: returnDate || new Date()
    }, session);

    // 11. Save purchase return
    await purchaseReturn.save({ session });

    // 12. Create audit log
    if (AuditLog) {
      await AuditLog.create(
        [
          {
            user: req.user._id,
            userName: req.user.name || 'System',
            action: 'create',
            module: 'PurchaseReturn',
            description: `Created debit note ${debitNoteNo} for purchase bill ${originalPurchaseNo}`,
            details: { purchaseReturnId: purchaseReturn._id },
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

    const populatedReturn = await PurchaseReturn.findById(purchaseReturn._id)
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');

    emitSocketEvent('purchaseReturn:created', populatedReturn);

    res.status(201).json({
      success: true,
      data: populatedReturn,
      message: `Debit note ${debitNoteNo} created successfully`,
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

// @desc    Get all Purchase Returns / Debit Notes
// @route   GET /api/purchases-returns
export const getPurchaseReturns = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      supplierId,
      status,
      paymentMode,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { debitNoteNo: { $regex: search, $options: 'i' } },
        { originalPurchaseNo: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate) query.returnDate.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (supplierId) query.supplier = supplierId;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;

    const total = await PurchaseReturn.countDocuments(query);
    const returns = await PurchaseReturn.find(query)
      .populate('supplier', 'name phone email')
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

// @desc    Get single Purchase Return / Debit Note
// @route   GET /api/purchases-returns/:id
export const getPurchaseReturn = async (req, res, next) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id)
      .populate('supplier', 'name phone email address gstNumber')
      .populate('items.product', 'name sku image');

    if (!purchaseReturn) {
      return res.status(404).json({
        success: false,
        message: 'Purchase return not found',
      });
    }

    res.status(200).json({
      success: true,
      data: purchaseReturn,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Purchase Return / Debit Note
// @route   PUT /api/purchases-returns/:id
export const updatePurchaseReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id).session(session);

    if (!purchaseReturn) {
      throw new Error('Purchase return not found');
    }

    if (purchaseReturn.status !== 'draft') {
      throw new Error('Only draft purchase returns can be updated');
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
        purchaseReturn[field] = req.body[field];
      }
    }

    await purchaseReturn.save({ session });
    if (session) {
      await session.commitTransaction();
    }

    const updated = await PurchaseReturn.findById(purchaseReturn._id)
      .populate('supplier', 'name phone email')
      .populate('items.product', 'name sku');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Purchase return updated successfully',
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

// @desc    Cancel Purchase Return / Debit Note
// @route   POST /api/purchases-returns/:id/cancel
export const cancelPurchaseReturn = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id).session(session);

    if (!purchaseReturn) {
      throw new Error('Purchase return not found');
    }

    if (purchaseReturn.status === 'cancelled') {
      throw new Error('Purchase return is already cancelled');
    }

    // Reverse stock movements
    for (const item of purchaseReturn.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        product.stock += item.returnQty;
        await product.save({ session });
      }
    }

    // Reverse original purchase bill return status
    const originalPurchase = await Purchase.findById(purchaseReturn.purchase).session(session);
    if (originalPurchase) {
      for (const item of purchaseReturn.items) {
        const originalItem = originalPurchase.items.find(
          (i) => i.product.toString() === item.product.toString()
        );
        if (originalItem) {
          originalItem.returnedQty = (originalItem.returnedQty || 0) - item.returnQty;
        }
      }
      originalPurchase.returnStatus = originalPurchase.items.some(
        (i) => (i.returnedQty || 0) > 0
      ) ? 'partially_returned' : 'not_returned';
      await originalPurchase.save({ session, validateBeforeSave: false });
    }

    // Reverse refund if any
    if (purchaseReturn.refundReceivedAmount > 0 && purchaseReturn.cashBankAccountId) {
      const bankAccount = await BankAccount.findById(
        purchaseReturn.cashBankAccountId
      ).session(session);
      if (bankAccount) {
        bankAccount.currentBalance -= purchaseReturn.refundReceivedAmount;
        await bankAccount.save({ session });
      }
    }

    // Reverse debit balance
    const supplier = await Supplier.findById(purchaseReturn.supplier).session(session);
    if (supplier && purchaseReturn.debitBalance > 0) {
      supplier.outstandingBalance = (supplier.outstandingBalance || 0) - purchaseReturn.debitBalance;
      await supplier.save({ session, validateBeforeSave: false });
    }

    purchaseReturn.status = 'cancelled';
    await purchaseReturn.save({ session });

    if (session) {
      await session.commitTransaction();
    }

    res.status(200).json({
      success: true,
      data: purchaseReturn,
      message: 'Purchase return cancelled successfully',
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

// @desc    Get unreturned purchases for a supplier
// @route   GET /api/purchases/supplier/:supplierId/unreturned
export const getUnreturnedPurchasesForSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const purchases = await Purchase.find({
      supplier: supplierId,
      status: { $ne: 'cancelled' },
      returnStatus: { $ne: 'fully_returned' },
    })
      .populate('supplier', 'name phone email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get returnable items from a purchase bill
// @route   GET /api/purchases/:id/returnable-items
export const getReturnableItemsFromPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findById(id).populate('items.product');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    // Get already returned items for this purchase
    const returnedItems = await PurchaseReturn.find({
      purchase: id,
      status: { $ne: 'cancelled' },
    });

    const returnedMap = {};
    for (const returnRecord of returnedItems) {
      for (const item of returnRecord.items) {
        const key = item.product.toString();
        returnedMap[key] = (returnedMap[key] || 0) + item.returnQty;
      }
    }

    // Calculate returnable items
    const returnableItems = purchase.items.map((item) => ({
      product: item.product._id,
      itemName: item.name,
      barcode: item.sku,
      purchasedQty: item.quantity,
      alreadyReturnedQty: returnedMap[item.product._id.toString()] || 0,
      returnableQty: item.quantity - (returnedMap[item.product._id.toString()] || 0),
      unit: 'piece',
      purchasePrice: item.purchasePrice,
      discountAmount: (purchase.discountAmount / purchase.subtotal) * (item.purchasePrice * item.quantity),
      taxPercent: item.taxRate || 0,
      reason: 'Other',
    }));

    res.status(200).json({
      success: true,
      data: {
        purchase: {
          purchaseNo: purchase.purchaseNumber,
          billDate: purchase.createdAt,
          supplierName: purchase.supplier ? purchase.supplier.name : 'Unknown',
          supplierId: purchase.supplier,
        },
        items: returnableItems,
      },
    });
  } catch (error) {
    next(error);
  }
};
