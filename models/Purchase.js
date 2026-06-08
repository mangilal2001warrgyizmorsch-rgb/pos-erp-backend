import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  purchasePrice: {
    type: Number,
    required: true,
  },
  taxRate: {
    type: Number, // GST % for this specific item (e.g. 18)
    default: 0,
  },
  cgst: {
    type: Number,
    default: 0,
  },
  sgst: {
    type: Number,
    default: 0,
  },
  igst: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  salesPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
  },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    transporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transporter',
    },
    invoiceNumber: {
      type: String, // Supplier's invoice number
      trim: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    stateOfSupply: {
      type: String,
      trim: true,
    },
    items: [purchaseItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    // Overall invoice tax sums
    totalCgst: {
      type: Number,
      default: 0,
    },
    totalSgst: {
      type: Number,
      default: 0,
    },
    totalIgst: {
      type: Number,
      default: 0,
    },
    taxAmount: { // Total tax sum
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    shippingCharges: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
      default: 'cash',
    },
    cashBankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'partial'],
      default: 'paid',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'received', 'cancelled', 'returned'],
      default: 'confirmed',
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
    accountingVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
    },
    accountingPosted: {
      type: Boolean,
      default: false,
    },
    accountingPostedAt: {
      type: Date,
    },
    accountingStatus: {
      type: String,
      enum: ['not_posted', 'posted', 'failed'],
      default: 'not_posted',
    },
    accountingError: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Purchase number generation moved to controller for atomic sequences

purchaseSchema.index({ status: 1, createdAt: -1 });
purchaseSchema.index({ supplier: 1, createdAt: -1 });
purchaseSchema.index({ 'items.product': 1, createdAt: -1 });
purchaseSchema.index({ accountingStatus: 1, createdAt: -1 });

export default mongoose.model('Purchase', purchaseSchema);
