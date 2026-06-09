import mongoose from "mongoose";
import { VOUCHER_STATUS_VALUES } from "../../constants/accounting.constants.js";

const voucherSchema = new mongoose.Schema(
  {
    voucherNo: {
      type: String,
      required: [true, "Voucher number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    voucherTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VoucherType",
    },
    voucherTypeCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
    },
    referenceModule: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceNo: {
      type: String,
      trim: true,
    },
    narration: {
      type: String,
      trim: true,
      maxlength: [1000, "Narration cannot exceed 1000 characters"],
    },
    totalDebit: {
      type: Number,
      default: 0,
      min: [0, "Total debit cannot be negative"],
    },
    totalCredit: {
      type: Number,
      default: 0,
      min: [0, "Total credit cannot be negative"],
    },
    status: {
      type: String,
      enum: VOUCHER_STATUS_VALUES,
      default: "DRAFT",
      uppercase: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    postedAt: Date,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },
    reversedAt: Date,
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: [500, "Reversal reason cannot exceed 500 characters"],
    },
    originalVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
    },
    reversalVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
    },
  },
  { timestamps: true },
);

voucherSchema.methods.isBalanced = function isBalanced() {
  return Number(this.totalDebit || 0).toFixed(2) === Number(this.totalCredit || 0).toFixed(2);
};

voucherSchema.pre("save", function validatePostedVoucherBalance(next) {
  if (this.status === "POSTED" && !this.isBalanced()) {
    return next(new Error("Total debit must equal total credit before posting"));
  }
  return next();
});

voucherSchema.index({ voucherTypeCode: 1, date: -1 });
voucherSchema.index({ status: 1, date: -1 });
voucherSchema.index({ referenceModule: 1, referenceId: 1 });
voucherSchema.index({ referenceModule: 1, referenceId: 1, voucherTypeCode: 1 });
voucherSchema.index({ financialYearId: 1 });

export default mongoose.model("Voucher", voucherSchema);
