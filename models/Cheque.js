import mongoose from 'mongoose';

const chequeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['received', 'issued'],
    required: true,
  },
  chequeNumber: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  partyName: {
    type: String,
    required: true,
  },
  bankName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Cleared', 'Bounced'],
    default: 'Pending',
  },
  clearanceAccountType: {
    type: String,
    enum: ['cash', 'bank'],
  },
  clearanceAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
  },
  clearanceTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashBankTransaction',
  }
}, {
  timestamps: true,
});

const Cheque = mongoose.model('Cheque', chequeSchema);

export default Cheque;
