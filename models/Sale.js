import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function () {
      return this.itemType === 'inventory';
    },
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
  name: {
    type: String,
    required: true,
  },
  itemName: {
    type: String,
  },
  description: {
    type: String,
    trim: true,
  },
  sku: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  returnedQty: {
    type: Number,
    default: 0,
    min: [0, 'Returned quantity cannot be negative'],
  },
  unitPrice: { // This is the salesPrice
    type: Number,
    required: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockBatch',
  },
  salePrice: {
    type: Number,
    default: 0,
  },
  mrp: {
    type: Number,
    default: 0,
  },
  selectedPriceType: {
    type: String,
    trim: true,
  },
  availableQtyAtSale: {
    type: Number,
    default: 0,
  },
  rate: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  purchasePrice: {
    type: Number,
    default: 0,
  },
  profitAmount: {
    type: Number,
    default: 0,
  },
  taxRate: {
    type: Number, // GST % for this specific item (e.g. 18)
    default: 0,
  },
  gstRate: {
    type: Number,
    default: 0,
  },
  taxableAmount: {
    type: Number,
    default: 0,
  },
  cgst: {
    type: Number,
    default: 0,
  },
  cgstAmount: {
    type: Number,
    default: 0,
  },
  sgst: {
    type: Number,
    default: 0,
  },
  sgstAmount: {
    type: Number,
    default: 0,
  },
  igst: {
    type: Number,
    default: 0,
  },
  igstAmount: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  hsn: {
    type: String,
    trim: true,
  },
  incomeLedger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger',
  },
  total: {
    type: Number,
    required: true,
  },
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      default: 'Walk-in Customer',
    },
    stateOfSupply: {
      type: String,
      trim: true,
    },
    items: [saleItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    taxableAmount: {
      type: Number,
      default: 0,
    },
    // Overall invoice tax sums
    totalCgst: {
      type: Number,
      default: 0,
    },
    cgstAmount: {
      type: Number,
      default: 0,
    },
    totalSgst: {
      type: Number,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      default: 0,
    },
    totalIgst: {
      type: Number,
      default: 0,
    },
    igstAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: { // Total tax sum
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi'],
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
    changeAmount: {
      type: Number,
      default: 0,
    },
    irn: {
      type: String,
      trim: true,
    },
    qrCode: {
      type: String,
      trim: true,
    },
    eInvoiceStatus: {
      type: String,
      enum: ['pending', 'generated', 'failed', 'not_applicable'],
      default: 'not_applicable',
    },
    ewayBillNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'refunded'],
      default: 'completed',
    },
    returnStatus: {
      type: String,
      enum: ['not_returned', 'partially_returned', 'fully_returned'],
      default: 'not_returned',
    },
    notes: {
      type: String,
      trim: true,
    },
    cashier: {
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

// Invoice number generation moved to controller for atomic sequences

saleSchema.index({ status: 1, createdAt: -1 });
saleSchema.index({ customer: 1, createdAt: -1 });
saleSchema.index({ 'items.product': 1, createdAt: -1 });
saleSchema.index({ accountingStatus: 1, createdAt: -1 });

export default mongoose.model('Sale', saleSchema);
