import mongoose from "mongoose";

const cashBankTransactionSchema = new mongoose.Schema({
  transactionNo: { type: String, required: true, unique: true },
  date: { type: Date, required: true, default: Date.now },
  type: {
    type: String,
    required: true,
    enum: [
      "payment_in",
      "payment_out",
      "cash_in",
      "cash_out",
      "bank_transfer",
      "sale_payment",
      "purchase_payment",
      "expense",
      "income",
      "sale_return_refund",
      "purchase_return_refund",
      "bank_transfer_in",
      "bank_transfer_out",
      "opening_cash",
      "closing_cash",
      "adjustment",
      "reversal",
      "cheque_clearance"
    ]
  },
  direction: { type: String, required: true, enum: ["in", "out"] },
  amount: { type: Number, required: true, min: [0, "Amount must be at least 0"] },
  paymentMode: { type: String, required: true },
  accountType: { type: String, required: true, enum: ["cash", "bank"] },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' }, // Ref to BankAccount collection (representing either cash or bank accounts)
  accountName: { type: String }, // Cached account name
  partyId: { type: mongoose.Schema.Types.ObjectId, refPath: 'partyType' },
  partyName: { type: String }, // Cached party name
  partyType: { type: String, enum: ['Customer', 'Supplier'] },
  referenceModule: {
    type: String,
    enum: [
      'sale_invoice',
      'purchase_bill',
      'payment_in',
      'payment_out',
      'expense',
      'income',
      'sale_return',
      'purchase_return',
      'cash_entry',
      'bank_transfer',
      'daily_closing',
      'manual_adjustment',
      'PaymentIn',
      'PaymentOut',
      'Manual',
      'SalesReturn',
      'PurchaseReturn',
      'cheque'
    ]
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNo: { type: String },
  description: { type: String },
  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },
  status: {
    type: String,
    required: true,
    enum: ["completed", "pending", "cancelled", "reversed"],
    default: "completed"
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reversedAt: { type: Date },
  reversalReason: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Accounting metadata
cashBankTransactionSchema.add({
  accountingVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  accountingPosted: { type: Boolean, default: false },
  accountingPostedAt: { type: Date },
  accountingStatus: { type: String, enum: ['not_posted', 'posted', 'failed'], default: 'not_posted' },
  accountingError: { type: String },
});

// Indexes for super-fast dashboard statistics & filtering
cashBankTransactionSchema.index({ type: 1, direction: 1, date: -1 });
cashBankTransactionSchema.index({ accountId: 1, date: -1 });
cashBankTransactionSchema.index({ partyId: 1, date: -1 });
cashBankTransactionSchema.index({ referenceId: 1 });

export default mongoose.model("CashBankTransaction", cashBankTransactionSchema);
