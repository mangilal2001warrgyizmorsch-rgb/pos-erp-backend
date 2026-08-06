import mongoose from 'mongoose';

const stockBatchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
    },
    sourceType: {
      type: String,
      enum: ['opening_stock', 'purchase', 'manual_adjustment', 'return', 'legacy'],
      default: 'purchase',
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    batchNo: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    availableQty: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxPercent: {
      type: Number,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    extraChargePerProduct: {
      type: Number,
      default: 0,
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    expiryDate: {
      type: Date,
    },
    purchaseItemId: {
      type: String,
    },
    barcode: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
stockBatchSchema.index({ productId: 1, availableQty: 1 });
stockBatchSchema.index({ productId: 1, salePrice: 1, purchasePrice: 1, isActive: 1 });
stockBatchSchema.index({ batchNo: 1 });
stockBatchSchema.index({ createdAt: 1 }); // For FIFO/LIFO logic

export default mongoose.model('StockBatch', stockBatchSchema);
