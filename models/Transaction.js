import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  ledgerType: {
    type: String,
    enum: ['Cash', 'Bank', 'Loan', 'Other'],
    required: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'accountModel',
    required: false, // Required if ledgerType is Bank or Loan
  },
  accountModel: {
    type: String,
    enum: ['BankAccount', 'Loan'],
    required: false,
  },
  transactionType: {
    type: String,
    enum: ['Credit', 'Debit'], // Credit = Add money, Debit = Reduce money
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  remarks: {
    type: String,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId, // Link to a sale, purchase, etc.
    required: false,
  },
  referenceModel: {
    type: String,
    enum: ['Sale', 'Purchase', 'Expense', 'PurchaseReturn', 'SalesReturn'],
    required: false,
  }
}, {
  timestamps: true,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
