import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import StockMovement from '../models/StockMovement.js';
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
    reference,
    notes,
    createdBy
  }, session = null) => {
    // 1. Fetch Product
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const previousStock = product.stock || 0;
    const newStock = previousStock + Number(quantity);

    // 2. Create StockBatch
    const batch = new StockBatch({
      productId,
      purchaseId,
      batchNo: batchNo || `BATCH-${Date.now()}`,
      quantity: Number(quantity),
      availableQty: Number(quantity),
      purchasePrice: Number(purchasePrice),
      taxPercent: Number(taxPercent),
      discountPercent: Number(discountPercent),
      extraChargePerProduct: Number(extraChargePerProduct),
      salePrice: Number(salePrice || product.salesPrice || purchasePrice),
      expiryDate,
      barcode: barcode || product.barcode
    });
    await batch.save({ session });

    // 3. Update Product stock and standard pricing
    product.stock = newStock;
    product.purchasePrice = Number(purchasePrice);
    if (salePrice) product.salesPrice = Number(salePrice);
    await product.save({ session });

    // 4. Create StockMovement
    const movement = new StockMovement({
      product: productId,
      productName: product.name,
      type: 'purchase',
      quantity: Number(quantity),
      previousStock,
      newStock,
      reference,
      referenceId: purchaseId,
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

    // 2. Perform FIFO Deduction
    let remainingToDeduct = Number(quantity);
    const batches = await StockBatch.find({ productId, availableQty: { $gt: 0 } })
      .sort({ createdAt: 1 }) // FIFO
      .session(session);

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;
      const deduction = Math.min(batch.availableQty, remainingToDeduct);
      batch.availableQty -= deduction;
      remainingToDeduct -= deduction;
      await batch.save({ session });
    }

    if (remainingToDeduct > 0) {
      // Create a legacy fallback batch on the fly to support legacy data gracefully
      const fallbackBatch = new StockBatch({
        productId,
        batchNo: `LEGACY-AUTO-${Date.now()}`,
        quantity: remainingToDeduct,
        availableQty: 0, // fully deducted immediately
        purchasePrice: product.purchasePrice || 0,
        salePrice: product.salesPrice || product.purchasePrice || 0,
        barcode: product.barcode || product.sku
      });
      await fallbackBatch.save({ session });
      remainingToDeduct = 0;
    }

    // 3. Update Product stock level
    product.stock = newStock;
    await product.save({ session });

    // 4. Create StockMovement
    const movement = new StockMovement({
      product: productId,
      productName: product.name,
      type: 'sale',
      quantity: -Number(quantity),
      previousStock,
      newStock,
      reference,
      referenceId,
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

    return movement;
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
