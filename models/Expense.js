import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
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
      required: [true, 'Category is required'],
      trim: true,
    },
    categoryName: {
      type: String,
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
    reference: {
      type: String,
      trim: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
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

export default mongoose.model('Expense', expenseSchema);
