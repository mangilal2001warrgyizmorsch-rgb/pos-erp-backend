import mongoose from "mongoose";

const cashBankTransactionSchema = new mongoose.Schema({
  transactionNo: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ["payment_in", "payment_out", "cash_in", "cash_out", "bank_transfer"] },
  direction: { type: String, required: true, enum: ["in", "out"] },
  amount: { type: Number, required: true },
  paymentMode: { type: String, required: true },
  accountType: { type: String, required: true, enum: ["cash", "bank"] },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  partyId: { type: mongoose.Schema.Types.ObjectId, refPath: 'partyType' },
  partyType: { type: String, enum: ['Customer', 'Supplier'] },
  referenceModule: { type: String, enum: ['PaymentIn', 'PaymentOut', 'Manual'] },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  receiptNo: { type: String },
  date: { type: Date, required: true, default: Date.now },
  notes: { type: String },
}, { timestamps: true });

export default mongoose.model("CashBankTransaction", cashBankTransactionSchema);
