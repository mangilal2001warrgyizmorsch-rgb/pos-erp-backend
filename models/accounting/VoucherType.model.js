import mongoose from "mongoose";
import {
  ACCOUNTING_VOUCHER_TYPE_VALUES,
  NUMBERING_METHOD_VALUES,
} from "../../constants/accounting.constants.js";

const voucherTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Voucher type name is required"],
      trim: true,
      maxlength: [100, "Voucher type name cannot exceed 100 characters"],
    },
    code: {
      type: String,
      required: [true, "Voucher type code is required"],
      unique: true,
      enum: ACCOUNTING_VOUCHER_TYPE_VALUES,
      uppercase: true,
      trim: true,
    },
    prefix: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    suffix: {
      type: String,
      trim: true,
      default: "",
    },
    currentNumber: {
      type: Number,
      default: 0,
      min: [0, "Current number cannot be negative"],
    },
    numberingMethod: {
      type: String,
      enum: NUMBERING_METHOD_VALUES,
      default: "automatic",
      lowercase: true,
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

voucherTypeSchema.index({ isActive: 1 });

export default mongoose.model("VoucherType", voucherTypeSchema);
