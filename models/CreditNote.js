import mongoose from 'mongoose';

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    referenceReturn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesReturn',
    },
    originalInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired', 'cancelled'],
      default: 'active',
    },
    expiryDate: {
      type: Date, // Typically 6-12 months from issue
    },
    notes: {
      type: String,
      trim: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save to set expiry date if not provided (e.g., 6 months default)
creditNoteSchema.pre('save', function (next) {
  if (!this.expiryDate) {
    const defaultExpiry = new Date();
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6);
    this.expiryDate = defaultExpiry;
  }
  next();
});

creditNoteSchema.index({ customer: 1, status: 1 });

export default mongoose.model('CreditNote', creditNoteSchema);
