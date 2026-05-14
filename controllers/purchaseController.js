import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import StockBatch from '../models/StockBatch.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { recordStockMovement } from '../utils/stockMovement.js';

// @desc    Create purchase (with inventory increase)
// @route   POST /api/purchases
import SalesPrice from '../models/SalesPrice.js';

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
    } = req.body;

    const purchaseNumber = await generateSequenceNumber('PUR');

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
      createdBy: req.user._id,
    });

    const finalItems = [];

    for (const item of items) {
      let productId = item.product;

      // Inline product creation
      if (item.isNewProduct && item.newProductData) {
        const newProd = new Product({
          ...item.newProductData,
          stock: 0,
        });
        await newProd.save();
        productId = newProd._id;
      }

      finalItems.push({
        ...item,
        product: productId,
      });

      if (purchase.status === 'confirmed' || purchase.status === 'received') {
        const product = await Product.findByIdAndUpdate(
          productId,
          { $inc: { stock: item.quantity } },
          { new: true }
        );

        if (!product) {
          throw new Error(`Product not found for ID: ${productId}`);
        }

        const batchNo = `BATCH-${Date.now()}-${productId.toString().slice(-4)}`;
        
        // StockBatch
        const stockBatch = await StockBatch.create({
          productId: productId,
          purchaseId: purchase._id,
          batchNo: batchNo,
          quantity: item.quantity,
          availableQty: item.quantity,
          purchasePrice: item.purchasePrice || 0,
          taxPercent: item.taxRate || 0,
          discountPercent: item.discount || 0,
          extraChargePerProduct: (shippingCharges || 0) / items.reduce((s, i) => s + i.quantity, 0),
          salePrice: item.salesPrice || 0,
          barcode: product.barcode,
        });

        // SalesPrice Entry
        await SalesPrice.create({
          productId: productId,
          purchaseId: purchase._id,
          batchId: stockBatch._id,
          barcode: product.barcode || product.sku,
          purchasePrice: item.purchasePrice || 0,
          taxPercent: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
          discountPercent: item.discount || 0,
          discountAmount: item.discountAmount || 0,
          extraCharges: shippingCharges || 0,
          extraChargePerProduct: (shippingCharges || 0) / items.reduce((s, i) => s + i.quantity, 0),
          calculatedSalePrice: item.salesPrice || 0,
          availableQty: item.quantity,
          pricingStatus: 'active',
        });

        await recordStockMovement({
          productId: product._id,
          productName: product.name,
          type: 'purchase',
          quantity: item.quantity,
          previousStock: product.stock - item.quantity,
          newStock: product.stock,
          reference: purchaseNumber,
          referenceId: purchase._id,
          createdBy: req.user._id,
        });
      }
    }

    purchase.items = finalItems;
    await purchase.save();

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
