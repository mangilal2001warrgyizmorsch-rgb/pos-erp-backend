import mongoose from "mongoose";
import { PARTY_TYPE_VALUES } from "../../constants/accounting.constants.js";

const voucherEntrySchema = new mongoose.Schema(
  {
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      required: [true, "Voucher is required"],
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      required: [true, "Ledger is required"],
    },
    ledgerName: {
      type: String,
      trim: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, "Debit cannot be negative"],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, "Credit cannot be negative"],
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    partyType: {
      type: String,
      enum: PARTY_TYPE_VALUES,
      default: "none",
      lowercase: true,
    },
    costCenterId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    narration: {
      type: String,
      trim: true,
      maxlength: [500, "Entry narration cannot exceed 500 characters"],
    },
  },
  { timestamps: true },
);

voucherEntrySchema.pre("validate", function validateDebitCreditLine(next) {
  const debit = Number(this.debit || 0);
  const credit = Number(this.credit || 0);

  if (debit > 0 && credit > 0) {
    return next(new Error("Voucher entry cannot contain both debit and credit"));
  }

  if (debit === 0 && credit === 0) {
    return next(new Error("Voucher entry must contain either debit or credit"));
  }

  return next();
});

voucherEntrySchema.index({ voucherId: 1 });
voucherEntrySchema.index({ ledgerId: 1 });

export default mongoose.model("VoucherEntry", voucherEntrySchema);
