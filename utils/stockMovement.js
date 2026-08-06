import StockMovement from '../models/StockMovement.js';

/**
 * Utility to record stock movements atomically within a session
 * 
 * @param {Object} params
 * @param {ObjectId} params.productId
 * @param {String} params.productName
 * @param {String} params.type ('purchase', 'sale', 'return', 'adjustment', 'transfer', 'cancellation')
 * @param {Number} params.quantity (Positive for increase, negative for decrease)
 * @param {Number} params.previousStock
 * @param {Number} params.newStock
 * @param {String} params.reference (e.g. Invoice Number)
 * @param {ObjectId} params.referenceId (e.g. Sale ID)
 * @param {String} params.notes
 * @param {ObjectId} params.createdBy
 * @param {Object} session (Mongoose session)
 */
export const recordStockMovement = async (params, session = null) => {
  const movement = new StockMovement({
    product: params.productId,
    productName: params.productName,
    type: params.type,
    quantity: params.quantity,
    previousStock: params.previousStock,
    newStock: params.newStock,
    reference: params.reference,
    referenceId: params.referenceId,
    batchId: params.batchId,
    salePrice: params.salePrice,
    notes: params.notes,
    createdBy: params.createdBy,
  });

  if (session) {
    await movement.save({ session });
  } else {
    await movement.save();
  }
};
