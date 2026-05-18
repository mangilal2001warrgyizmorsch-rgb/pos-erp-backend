import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
    trim: true,
  },
  accountType: {
    type: String,
    required: true,
    enum: ["cash", "bank"],
    default: "bank",
  },
  bankName: {
    type: String,
    trim: true,
  },
  accountNumber: {
    type: String,
    trim: true,
  },
  ifscCode: {
    type: String,
    trim: true,
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
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Since cash accounts do not have account numbers, we only enforce unique account numbers for active bank accounts if they are provided
bankAccountSchema.index(
  { accountNumber: 1 },
  { unique: true, partialFilterExpression: { accountNumber: { $exists: true, $ne: "" } } }
);

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

export default BankAccount;
