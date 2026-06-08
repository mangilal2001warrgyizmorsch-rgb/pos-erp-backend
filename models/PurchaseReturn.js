import mongoose from 'mongoose';

const purchaseReturnItemSchema = new mongoose.Schema({
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
  purchasedQty: {
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
  purchasePrice: {
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
    enum: ['Damaged from supplier', 'Wrong item received', 'Extra quantity', 'Expired', 'Quality issue', 'Other'],
    default: 'Other',
  },
});

const purchaseReturnSchema = new mongoose.Schema(
  {
    debitNoteNo: {
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
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
    },
    billDate: {
      type: Date,
      required: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
    },
    supplierPhone: {
      type: String,
      default: '',
    },
    supplierGstNo: {
      type: String,
      default: '',
    },
    address: {
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
    items: [purchaseReturnItemSchema],
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
      enum: ['cash', 'bank', 'vendor_credit', 'replacement'],
      required: true,
    },
    refundType: {
      type: String,
      enum: ['refund_received', 'keep_as_debit', 'adjust_future_purchase'],
      default: 'refund_received',
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank', 'Card', 'Wallet', 'Credit'],
      default: 'Bank',
    },
    cashBankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    refundReceivedAmount: {
      type: Number,
      default: 0,
    },
    debitBalance: {
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
purchaseReturnSchema.index({ debitNoteNo: 1, returnNumber: 1 });
purchaseReturnSchema.index({ purchase: 1, supplier: 1, createdAt: -1 });
purchaseReturnSchema.index({ supplier: 1, createdAt: -1 });
purchaseReturnSchema.index({ status: 1, createdAt: -1 });
purchaseReturnSchema.index({ purchaseNumber: 1 });

export default mongoose.model('PurchaseReturn', purchaseReturnSchema);
