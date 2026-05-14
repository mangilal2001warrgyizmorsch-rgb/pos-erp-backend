import mongoose from 'mongoose';
import SalesReturn from '../models/SalesReturn.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import CreditNote from '../models/CreditNote.js';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { recordStockMovement } from '../utils/stockMovement.js';

// @desc    Process a sales return
// @route   POST /api/returns/sales
export const createSalesReturn = async (req, res, next) => {
  try {
    const { saleId, items, refundMethod, notes } = req.body;

    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    if (sale.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot return items from a cancelled sale' });
    }

    // Process return items
    let subtotal = 0;
    const returnItems = [];

    for (const returnItem of items) {
      // Find original item in sale
      const originalItem = sale.items.find(
        (item) => item.product.toString() === returnItem.product
      );

      if (!originalItem) {
        throw new Error(`Item ${returnItem.product} was not part of the original sale`);
      }

      // We should theoretically check if (already returned qty + this return qty <= original qty),
      // but for simplicity we assume full return validation happens client side or via a Returns array in Sale model.

      const itemTotal = returnItem.quantity * originalItem.unitPrice;
      subtotal += itemTotal;

      returnItems.push({
        product: originalItem.product,
        name: originalItem.name,
        sku: originalItem.sku,
        quantity: returnItem.quantity,
        unitPrice: originalItem.unitPrice,
        total: itemTotal,
        returnReason: returnItem.returnReason || 'customer_choice',
      });

      // Restore stock if the item is not damaged beyond repair
      // (For this implementation, we'll restore all except 'damaged')
      if (returnItem.returnReason !== 'damaged') {
        const product = await Product.findByIdAndUpdate(
          originalItem.product,
          { $inc: { stock: returnItem.quantity } },
          { new: true }
        );

        if (product) {
          await recordStockMovement({
            productId: product._id,
            productName: product.name,
            type: 'return',
            quantity: returnItem.quantity,
            previousStock: product.stock - returnItem.quantity,
            newStock: product.stock,
            reference: sale.invoiceNumber,
            referenceId: sale._id,
            notes: `Sales Return: ${returnItem.returnReason}`,
            createdBy: req.user._id,
          });
        }
      }
    }

    // Calculate taxes proportionately (simplified)
    const taxProportion = sale.taxAmount / sale.subtotal || 0;
    const taxAmount = subtotal * taxProportion;
    const totalAmount = subtotal + taxAmount;

    // Generate Return Number
    const returnNumber = await generateSequenceNumber('SRN');

    const salesReturn = new SalesReturn({
      returnNumber,
      sale: sale._id,
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customer,
      customerName: sale.customerName,
      items: returnItems,
      subtotal,
      taxAmount,
      totalAmount,
      refundMethod,
      notes,
      cashier: req.user._id,
    });

    await salesReturn.save();

    // Handle Credit Note logic
    if (refundMethod === 'credit_note' && sale.customer) {
      const creditNoteNumber = await generateSequenceNumber('CRN');
      const creditNote = new CreditNote({
        creditNoteNumber,
        customer: sale.customer,
        referenceReturn: salesReturn._id,
        originalInvoice: sale._id,
        amount: totalAmount,
        remainingBalance: totalAmount,
        issuedBy: req.user._id,
      });
      await creditNote.save();
    }

    // Handle Wallet logic
    if (refundMethod === 'wallet' && sale.customer) {
      await Customer.findByIdAndUpdate(
        sale.customer,
        { $inc: { walletBalance: totalAmount } }
      );
    }

    // Update customer stats
    if (sale.customer) {
      await Customer.findByIdAndUpdate(
        sale.customer,
        {
          $inc: { totalSpent: -totalAmount },
        }
      );
    }



    res.status(201).json({
      success: true,
      data: salesReturn,
    });
  } catch (error) {
    // Catch custom errors
    if (error.message.includes('not part of the original sale')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get all sales returns
// @route   GET /api/returns/sales
export const getSalesReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const returns = await SalesReturn.find(query)
      .populate('customer', 'name phone')
      .populate('cashier', 'name')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SalesReturn.countDocuments(query);

    res.status(200).json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process a purchase return
// @route   POST /api/returns/purchases
export const createPurchaseReturn = async (req, res, next) => {
  try {
    const { purchaseId, items, refundMethod, notes } = req.body;

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    if (purchase.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot return items from a cancelled purchase' });
    }

    let subtotal = 0;
    const returnItems = [];

    for (const returnItem of items) {
      const originalItem = purchase.items.find(
        (item) => item.product.toString() === returnItem.product
      );

      if (!originalItem) {
        throw new Error(`Item ${returnItem.product} was not part of the original purchase`);
      }

      const itemTotal = returnItem.quantity * originalItem.purchasePrice;
      subtotal += itemTotal;

      returnItems.push({
        product: originalItem.product,
        name: originalItem.productName || 'Unknown Product',
        sku: originalItem.sku || 'Unknown SKU',
        quantity: returnItem.quantity,
        purchasePrice: originalItem.purchasePrice,
        total: itemTotal,
        returnReason: returnItem.returnReason || 'other',
      });

      // Deduct stock for returned items
      const product = await Product.findOneAndUpdate(
        { _id: originalItem.product, stock: { $gte: returnItem.quantity } },
        { $inc: { stock: -returnItem.quantity } },
        { new: true }
      );

      if (!product) {
        throw new Error(`Insufficient stock for product ${originalItem.product} to process return.`);
      }

      await recordStockMovement({
        productId: product._id,
        productName: product.name,
        type: 'return', // Supplier return
        quantity: -returnItem.quantity,
        previousStock: product.stock + returnItem.quantity,
        newStock: product.stock,
        reference: purchase.purchaseNumber || purchase.invoiceNumber,
        referenceId: purchase._id,
        notes: `Purchase Return: ${returnItem.returnReason}`,
        createdBy: req.user._id,
      });
    }

    const taxProportion = purchase.taxAmount / purchase.subtotal || 0;
    const taxAmount = subtotal * taxProportion;
    const totalAmount = subtotal + taxAmount;

    const returnNumber = await generateSequenceNumber('PRN');

    const purchaseReturn = new PurchaseReturn({
      returnNumber,
      purchase: purchase._id,
      purchaseNumber: purchase.purchaseNumber || purchase.invoiceNumber,
      supplier: purchase.supplier,
      items: returnItems,
      subtotal,
      taxAmount,
      totalAmount,
      refundMethod,
      notes,
      createdBy: req.user._id,
    });

    await purchaseReturn.save();

    // Update supplier stats
    if (purchase.supplier) {
      const updateData = { $inc: { totalPurchases: -totalAmount } };
      if (refundMethod === 'vendor_credit') {
        updateData.$inc.outstandingBalance = -totalAmount; // Reduce what we owe them
      }
      
      await Supplier.findByIdAndUpdate(
        purchase.supplier,
        updateData
      );
    }



    res.status(201).json({
      success: true,
      data: purchaseReturn,
    });
  } catch (error) {
    if (error.message.includes('not part of the original purchase') || error.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Get all purchase returns
// @route   GET /api/returns/purchases
export const getPurchaseReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { purchaseNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const returns = await PurchaseReturn.find(query)
      .populate('supplier', 'name phone')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await PurchaseReturn.countDocuments(query);

    res.status(200).json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
