import mongoose from "mongoose";

const transactionItemSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  narration: {
    type: String,
    required: true,
    trim: true,
  },
  debit: {
    type: Number,
    default: 0,
  },
  credit: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  mappedLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ledger",
  },
  status: {
    type: String,
    enum: ["pending", "posted", "skipped"],
    default: "pending",
  },
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
  },
});

const bankStatementImportSchema = new mongoose.Schema(
  {
    statementNo: {
      type: String,
      required: true,
      unique: true,
    },
    bank: {
      type: String, // e.g., HDFC, SBI
      default: "Generic",
    },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    importDate: {
      type: Date,
      default: Date.now,
    },
    transactions: [transactionItemSchema],
    status: {
      type: String,
      enum: ["pending", "partially_posted", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

bankStatementImportSchema.index({ bankLedgerId: 1, importDate: -1 });

export default mongoose.model("BankStatementImport", bankStatementImportSchema);
