import mongoose from 'mongoose';

const saleReturnItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  barcode: {
    type: String,
    default: '',
  },
  itemName: {
    type: String,
    required: true,
  },
  soldQty: {
    type: Number,
    required: true,
    min: 1,
  },
  alreadyReturnedQty: {
    type: Number,
    default: 0,
    min: 0,
  },
  returnQty: {
    type: Number,
    required: true,
    min: 1,
  },
  unit: {
    type: String,
    default: 'piece',
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  taxPercent: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  returnAmount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    enum: ['Damaged', 'Wrong item', 'Expired', 'Customer cancelled', 'Exchange', 'Other'],
    default: 'Other',
  },
  stockAction: {
    type: String,
    enum: ['restore_stock', 'damaged_stock', 'no_stock'],
    default: 'restore_stock',
  },
});

const salesReturnSchema = new mongoose.Schema(
  {
    creditNoteNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      default: '',
    },
    customerGstNo: {
      type: String,
      default: '',
    },
    billingAddress: {
      type: String,
      default: '',
    },
    returnDate: {
      type: Date,
      default: Date.now,
    },
    stateOfSupply: {
      type: String,
      default: '',
    },
    items: [saleReturnItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    refundMethod: {
      type: String,
      enum: ['cash', 'bank', 'credit_note', 'wallet'],
      required: true,
    },
    refundType: {
      type: String,
      enum: ['refund_now', 'keep_as_credit', 'adjust_future_invoice'],
      default: 'refund_now',
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank', 'Card', 'Wallet', 'Credit'],
      default: 'Cash',
    },
    cashBankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    creditBalance: {
      type: Number,
      default: 0,
    },
    referenceNo: {
      type: String,
      default: '',
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'partially_refunded', 'refunded', 'adjusted', 'cancelled'],
      default: 'issued',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: {
      type: [String],
      default: [],
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
      default: '',
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

// Indexes for queries
salesReturnSchema.index({ creditNoteNo: 1, returnNumber: 1 });
salesReturnSchema.index({ sale: 1, customer: 1, createdAt: -1 });
salesReturnSchema.index({ customer: 1, createdAt: -1 });
salesReturnSchema.index({ status: 1, createdAt: -1 });
salesReturnSchema.index({ invoiceNumber: 1 });

export default mongoose.model('SalesReturn', salesReturnSchema);
