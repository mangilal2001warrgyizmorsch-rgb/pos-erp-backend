import mongoose from 'mongoose';

const salesPriceSchema = new mongoose.Schema(
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
    purchaseItemId: {
      type: String, // Or ObjectId if purchase items have their own schema/IDs
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockBatch',
    },
    barcode: {
      type: String,
      required: true,
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
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    extraCharges: {
      type: Number,
      default: 0,
    },
    extraChargePerProduct: {
      type: Number,
      default: 0,
    },
    calculatedSalePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    availableQty: {
      type: Number,
      required: true,
      min: 0,
    },
    pricingStatus: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookups during sales
salesPriceSchema.index({ barcode: 1, pricingStatus: 1 });
salesPriceSchema.index({ productId: 1, pricingStatus: 1, availableQty: 1 });
salesPriceSchema.index({ createdAt: 1 });

export default mongoose.model('SalesPrice', salesPriceSchema);
