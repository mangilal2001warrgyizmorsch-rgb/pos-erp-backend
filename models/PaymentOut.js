import mongoose from "mongoose";

const paymentOutSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  partyName: { type: String, required: true },
  amountPaid: { type: Number, required: true },
  paymentMode: { type: String, required: true, enum: ["Cash", "Bank", "UPI", "Card", "Cheque", "Wallet", "Other"] },
  cashBankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  linkedPurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  referenceNo: { type: String },
  description: { type: String },
  attachments: [{ type: String }],
  date: { type: Date, required: true, default: Date.now },
  status: { type: String, default: "completed" },
}, { timestamps: true });

export default mongoose.model("PaymentOut", paymentOutSchema);
