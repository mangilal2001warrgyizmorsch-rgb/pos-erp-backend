import mongoose from "mongoose";

const partyLedgerSchema = new mongoose.Schema({
  partyId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'partyType' },
  partyType: { type: String, required: true, enum: ['Customer', 'Supplier'] },
  type: { type: String, required: true, enum: ['sale', 'purchase', 'payment_in', 'payment_out', 'opening_balance', 'return'] },
  debitAmount: { type: Number, default: 0 },
  creditAmount: { type: Number, default: 0 },
  balanceAfter: { type: Number, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  receiptNo: { type: String },
  date: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'paid' },
  notes: { type: String },
}, { timestamps: true });

export default mongoose.model("PartyLedger", partyLedgerSchema);
