import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import StockMovement from '../models/StockMovement.js';
import SalesPrice from '../models/SalesPrice.js';
import { emitSocketEvent } from '../utils/socket.js';

export const inventoryService = {
  /**
   * Add stock (Purchase flow). Creates a new StockBatch and logs stock movement.
   */
  addStock: async ({
    productId,
    purchaseId,
    batchNo,
    quantity,
    purchasePrice,
    taxPercent = 0,
    discountPercent = 0,
    extraChargePerProduct = 0,
    salePrice,
    expiryDate,
    barcode,
    sourceType = purchaseId ? 'purchase' : 'manual_adjustment',
    reference,
    notes,
    createdBy
  }, session = null) => {
    // 1. Fetch Product
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const previousStock = product.stock || 0;
    const newStock = previousStock + Number(quantity);

    const quantityToAdd = Number(quantity);
    const nextPurchasePrice = Number(purchasePrice || 0);
    const nextSalePrice = Number(salePrice || product.salesPrice || purchasePrice || 0);

    // 2. Merge only same product + same purchase price + same sale price.
    let batch = await StockBatch.findOne({
      productId,
      isActive: { $ne: false },
      purchasePrice: nextPurchasePrice,
      salePrice: nextSalePrice,
      expiryDate: expiryDate || null,
    }).sort({ createdAt: -1 }).session(session);

    if (batch) {
      batch.quantity += quantityToAdd;
      batch.availableQty += quantityToAdd;
      batch.taxPercent = Number(taxPercent);
      batch.discountPercent = Number(discountPercent);
      batch.extraChargePerProduct = Number(extraChargePerProduct);
      if (barcode || product.barcode) batch.barcode = barcode || product.barcode;
      await batch.save({ session });
    } else {
      batch = new StockBatch({
        productId,
        purchaseId,
        sourceType,
        sourceId: purchaseId,
        batchNo: batchNo || `BATCH-${Date.now()}`,
        quantity: quantityToAdd,
        availableQty: quantityToAdd,
        purchasePrice: nextPurchasePrice,
        taxPercent: Number(taxPercent),
        discountPercent: Number(discountPercent),
        extraChargePerProduct: Number(extraChargePerProduct),
        salePrice: nextSalePrice,
        expiryDate,
        barcode: barcode || product.barcode
      });
      await batch.save({ session });
    }

    // 3. Update Product stock and standard pricing
    product.stock = newStock;
    product.purchasePrice = nextPurchasePrice;
    if (salePrice !== undefined && salePrice !== null) product.salesPrice = nextSalePrice;
    await product.save({ session });

    // 4. Create StockMovement
    const movement = new StockMovement({
      product: productId,
      productName: product.name,
      type: sourceType === 'opening_stock' || sourceType === 'manual_adjustment' ? 'adjustment' : 'purchase',
      quantity: quantityToAdd,
      previousStock,
      newStock,
      reference,
      referenceId: purchaseId,
      batchId: batch._id,
      salePrice: nextSalePrice,
      notes: notes || `Stock added via purchase batch: ${batchNo}`,
      createdBy
    });
    await movement.save({ session });

    // 5. Broadcast Socket updates
    process.nextTick(() => {
      try {
        emitSocketEvent('inventory:updated', { productId, stock: newStock });
        if (newStock <= product.lowStockThreshold) {
          emitSocketEvent('stock:low', { productId, name: product.name, stock: newStock });
        }
      } catch (err) {
        console.error('[Socket Service Error] Failed to emit stock additions:', err);
      }
    });

    return { batch, movement };
  },

  /**
   * Deduct stock using FIFO (Sales flow). Deducts available quantities from batches.
   */
  deductStock: async ({
    productId,
    batchId,
    quantity,
    reference,
    referenceId,
    notes,
    createdBy
  }, session = null) => {
    // 1. Fetch Product
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const previousStock = product.stock || 0;
    if (previousStock < Number(quantity)) {
      throw new Error(`Insufficient stock for product ${product.name}. Available: ${previousStock}, Requested: ${quantity}`);
    }

    const newStock = previousStock - Number(quantity);

    const quantityToDeduct = Number(quantity);
    let selectedBatch = null;
    let purchaseCost = Number(product.purchasePrice || 0) * quantityToDeduct;

    if (batchId) {
      selectedBatch = await StockBatch.findOne({
        _id: batchId,
        productId,
        isActive: { $ne: false },
      }).session(session);
      if (!selectedBatch) {
        throw new Error(`Selected price batch was not found for ${product.name}.`);
      }
      if (Number(selectedBatch.availableQty || 0) < quantityToDeduct) {
        throw new Error(`Selected price batch has only ${selectedBatch.availableQty} qty available.`);
      }
      selectedBatch.availableQty -= quantityToDeduct;
      purchaseCost = Number(selectedBatch.purchasePrice || 0) * quantityToDeduct;
      await selectedBatch.save({ session });
      await SalesPrice.updateMany(
        { batchId: selectedBatch._id },
        { $inc: { availableQty: -quantityToDeduct } },
        { session }
      );
    } else {
      const activeBatches = await StockBatch.find({ productId, isActive: { $ne: false }, availableQty: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .session(session);
      if (activeBatches.length > 1) {
        throw new Error(`Please select selling price for ${product.name}.`);
      }
      selectedBatch = activeBatches[0] || null;
      if (selectedBatch) {
        if (Number(selectedBatch.availableQty || 0) < quantityToDeduct) {
          throw new Error(`Selected price batch has only ${selectedBatch.availableQty} qty available.`);
        }
        selectedBatch.availableQty -= quantityToDeduct;
        purchaseCost = Number(selectedBatch.purchasePrice || 0) * quantityToDeduct;
        await selectedBatch.save({ session });
        await SalesPrice.updateMany(
          { batchId: selectedBatch._id },
          { $inc: { availableQty: -quantityToDeduct } },
          { session }
        );
      }
    }

    // 3. Update Product stock level
    product.stock = newStock;
    await product.save({ session });

    // 4. Create StockMovement
    const movement = new StockMovement({
      product: productId,
      productName: product.name,
      type: 'sale',
      quantity: -quantityToDeduct,
      previousStock,
      newStock,
      reference,
      referenceId,
      batchId: selectedBatch?._id,
      salePrice: selectedBatch?.salePrice || product.salesPrice || 0,
      notes: notes || `Stock deducted via sale: ${reference}`,
      createdBy
    });
    await movement.save({ session });

    // 5. Broadcast Socket updates
    process.nextTick(() => {
      try {
        emitSocketEvent('inventory:updated', { productId, stock: newStock });
        if (newStock <= product.lowStockThreshold) {
          emitSocketEvent('stock:low', { productId, name: product.name, stock: newStock });
        }
      } catch (err) {
        console.error('[Socket Service Error] Failed to emit stock deductions:', err);
      }
    });

    return { movement, batch: selectedBatch, purchaseCost };
  },

  /**
   * Restore stock (Returns flow). Restores stock back to newest or existing batches.
   */
  restoreStock: async ({
    productId,
    quantity,
    reference,
    referenceId,
    notes,
    createdBy
  }, session = null) => {
    // 1. Fetch Product
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const previousStock = product.stock || 0;
    const newStock = previousStock + Number(quantity);

    // 2. Find newest batch to add the stock back into
    let batch = await StockBatch.findOne({ productId })
      .sort({ createdAt: -1 })
      .session(session);

    if (batch) {
      batch.availableQty += Number(quantity);
      await batch.save({ session });
    } else {
      // Create fallback batch on return if no batches exist
      batch = new StockBatch({
        productId,
        batchNo: `RETURN-AUTO-${Date.now()}`,
        quantity: Number(quantity),
        availableQty: Number(quantity),
        purchasePrice: product.purchasePrice || 0,
        salePrice: product.salesPrice || product.purchasePrice || 0,
        barcode: product.barcode || product.sku
      });
      await batch.save({ session });
    }

    // 3. Update Product stock
    product.stock = newStock;
    await product.save({ session });

    // 4. Create StockMovement
    const movement = new StockMovement({
      product: productId,
      productName: product.name,
      type: 'return',
      quantity: Number(quantity),
      previousStock,
      newStock,
      reference,
      referenceId,
      notes: notes || `Stock restored via return: ${reference}`,
      createdBy
    });
    await movement.save({ session });

    // 5. Broadcast Socket updates
    process.nextTick(() => {
      try {
        emitSocketEvent('inventory:updated', { productId, stock: newStock });
      } catch (err) {
        console.error('[Socket Service Error] Failed to emit stock restorations:', err);
      }
    });

    return movement;
  }
};
