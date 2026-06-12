import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    entryType: {
      type: String,
      enum: ['expense', 'income'],
      default: 'expense',
    },
    nature: {
      type: String,
      enum: ['direct', 'indirect'],
      default: 'indirect',
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    category: {
      type: String,
      trim: true,
    },
    categoryName: {
      type: String,
    },
    // Accounting ledger link
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
    },
    ledgerName: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
    },
    receiptImage: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer'],
      default: 'cash',
    },
    cashBankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    paymentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    reference: {
      type: String,
      trim: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    // GST fields
    gstApplicable: {
      type: Boolean,
      default: false,
    },
    gstRate: {
      type: Number,
      default: 0,
    },
    gstType: {
      type: String,
      enum: ['cgst_sgst', 'igst'],
      default: 'cgst_sgst',
    },
    taxableAmount: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    // Status
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Accounting metadata
    accountingVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    accountingPosted: { type: Boolean, default: false },
    accountingPostedAt: { type: Date },
    accountingStatus: { type: String, enum: ['not_posted', 'posted', 'failed'], default: 'not_posted' },
    accountingError: { type: String },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ entryType: 1, nature: 1, date: -1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ ledgerId: 1 });

export default mongoose.model('Expense', expenseSchema);
