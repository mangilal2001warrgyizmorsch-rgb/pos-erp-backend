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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Expense', expenseSchema);
