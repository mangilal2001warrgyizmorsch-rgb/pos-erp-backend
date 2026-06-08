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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accountingVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  accountingPosted: { type: Boolean, default: false },
  accountingPostedAt: { type: Date },
  accountingStatus: { type: String, enum: ["not_posted", "posted", "failed"], default: "not_posted" },
  accountingError: { type: String },
}, { timestamps: true });

export default mongoose.model("PaymentOut", paymentOutSchema);
