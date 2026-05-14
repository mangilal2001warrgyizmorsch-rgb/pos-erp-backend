import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
  },
  ifscCode: {
    type: String,
    required: true,
  },
  openingBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  currentBalance: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
});

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

export default BankAccount;
