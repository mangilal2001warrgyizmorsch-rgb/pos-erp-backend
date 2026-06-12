import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import SalesPrice from '../models/SalesPrice.js';
import mongoose from 'mongoose';
import { generateSequenceNumber } from '../utils/sequenceGenerator.js';
import { findOrCreateProductFromLineItem } from '../utils/productLineItem.js';

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const pushProductSummary = (bucket, seen, product, source) => {
  const id = product._id.toString();
  if (seen.has(id)) return;
  seen.add(id);
  bucket.push({
    productId: product._id,
    name: product.name,
    barcode: product.barcode,
    hsnCode: product.hsnCode,
    source,
  });
};

// @desc    Get all stock movements / stock history
// @route   GET /api/inventory/history
// @access  Private
export const getStockHistory = async (req, res) => {
  try {
    const { productId, type, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};

    if (productId) {
      query.product = productId;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await StockMovement.countDocuments(query);
    const movements = await StockMovement.find(query)
      .populate('product', 'name sku barcode unit')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: movements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save opening stock entry with auto product creation
// @route   POST /api/inventory/opening-stock
// @access  Private
export const createOpeningStockEntry = async (req, res, next) => {
  const isReplicaSet = mongoose.connection.client.topology?.description?.type !== 'Single';
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    const { items = [], openingStockDate, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one opening stock item is required');
    }

    const reference = await generateSequenceNumber('OPN', session);
    const createdProducts = [];
    const reusedProducts = [];
    const seenCreated = new Set();
    const seenReused = new Set();
    const savedItems = [];

    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Quantity must be greater than zero for opening stock items.');
      }

      const purchasePrice = roundMoney(item.purchasePrice ?? item.rate ?? item.purchaseRate ?? 0);
      const salesPrice = roundMoney(item.salePrice ?? item.salesPrice ?? purchasePrice);
      const taxRate = Number(item.taxRate ?? item.gstRate ?? 0);
      if (purchasePrice < 0 || salesPrice < 0 || taxRate < 0) {
        throw new Error('Price and tax values cannot be negative.');
      }

      const result = await findOrCreateProductFromLineItem(
        {
          ...item,
          purchasePrice,
          salesPrice,
          taxRate,
          openingStockDate,
        },
        'opening_stock',
        session
      );
      const product = result.product;

      if (result.created) pushProductSummary(createdProducts, seenCreated, product, 'opening_stock');
      else pushProductSummary(reusedProducts, seenReused, product, 'opening_stock');

      const currentProduct = await Product.findById(product._id).session(session);
      if (!currentProduct) throw new Error('Product not found while saving opening stock.');

      const previousStock = Number(currentProduct.stock || 0);
      const newStock = previousStock + quantity;
      currentProduct.stock = newStock;
      currentProduct.purchasePrice = purchasePrice;
      currentProduct.salesPrice = salesPrice;
      currentProduct.taxRate = taxRate;
      currentProduct.openingStockPrice = purchasePrice;
      currentProduct.openingStockDate = openingStockDate || new Date();
      await currentProduct.save({ session });

      const batchNo = item.batchNo || `${reference}-${currentProduct._id.toString().slice(-4).toUpperCase()}`;
      const [batch] = await StockBatch.create([{
        productId: currentProduct._id,
        batchNo,
        quantity,
        availableQty: quantity,
        purchasePrice,
        taxPercent: taxRate,
        salePrice: salesPrice,
        barcode: currentProduct.barcode || currentProduct.sku,
      }], { session });

      await SalesPrice.create([{
        productId: currentProduct._id,
        batchId: batch._id,
        barcode: currentProduct.barcode || currentProduct.sku,
        purchasePrice,
        taxPercent: taxRate,
        calculatedSalePrice: salesPrice,
        availableQty: quantity,
        pricingStatus: 'active',
      }], { session });

      await StockMovement.create([{
        product: currentProduct._id,
        productName: currentProduct.name,
        type: 'adjustment',
        quantity,
        previousStock,
        newStock,
        reference,
        notes: notes || 'Opening stock entry',
        createdBy: req.user._id,
      }], { session });

      savedItems.push({
        product: currentProduct._id,
        productId: currentProduct._id,
        itemName: currentProduct.name,
        productName: currentProduct.name,
        barcode: currentProduct.barcode,
        hsnCode: currentProduct.hsnCode,
        unit: currentProduct.unit,
        quantity,
        purchasePrice,
        salesPrice,
        taxRate,
        total: roundMoney(quantity * purchasePrice),
      });
    }

    if (session) await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: {
        reference,
        openingStockDate: openingStockDate || new Date(),
        items: savedItems,
      },
      createdProducts,
      reusedProducts,
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};
