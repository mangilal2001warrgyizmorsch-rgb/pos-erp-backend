import mongoose from 'mongoose';

const saleReturnItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  saleItemId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  itemType: {
    type: String,
    enum: ['inventory', 'non_stock_product', 'service'],
    default: 'inventory',
  },
  affectsInventory: {
    type: Boolean,
    default: function () {
      return this.itemType === 'inventory';
    },
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

const saleReturnSchema = new mongoose.Schema(
  {
    creditNoteNo: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
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
    originalInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    originalInvoiceNo: {
      type: String,
      required: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
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
    },
    refundType: {
      type: String,
      enum: ['refund_now', 'keep_as_credit', 'adjust_future_invoice'],
      default: 'refund_now',
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank', 'Card', 'Wallet'],
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
    status: {
      type: String,
      enum: ['draft', 'issued', 'partially_refunded', 'refunded', 'adjusted', 'cancelled'],
      default: 'issued',
    },
    notes: {
      type: String,
      default: '',
    },
    attachments: {
      type: [String],
      default: [],
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
saleReturnSchema.index({ creditNoteNo: 1, customerId: 1, createdAt: -1 });
saleReturnSchema.index({ originalInvoiceId: 1 });
saleReturnSchema.index({ status: 1, createdAt: -1 });
saleReturnSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model('SaleReturn', saleReturnSchema);
