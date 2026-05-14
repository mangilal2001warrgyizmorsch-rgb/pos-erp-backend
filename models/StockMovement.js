import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment', 'transfer', 'cancellation'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v !== 0; // Can be positive or negative, but not zero
        },
        message: 'Quantity cannot be zero',
      },
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reference: {
      type: String, // e.g. "INV-2605-00001", "PUR-2605-00001"
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId, // Sale ID or Purchase ID
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ reference: 1 });

export default mongoose.model('StockMovement', stockMovementSchema);
