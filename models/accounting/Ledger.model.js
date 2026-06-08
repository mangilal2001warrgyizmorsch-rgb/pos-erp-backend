import mongoose from "mongoose";
import {
  LEDGER_TYPE_VALUES,
  NORMAL_BALANCE_VALUES,
  PARTY_TYPE_VALUES,
} from "../../constants/accounting.constants.js";

const ledgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Ledger name is required"],
      trim: true,
      maxlength: [150, "Ledger name cannot exceed 150 characters"],
    },
    code: {
      type: String,
      required: [true, "Ledger code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [50, "Ledger code cannot exceed 50 characters"],
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountGroup",
      required: [true, "Account group is required"],
    },
    ledgerType: {
      type: String,
      enum: LEDGER_TYPE_VALUES,
      default: "OTHER",
      uppercase: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Opening balance cannot be negative"],
    },
    openingBalanceType: {
      type: String,
      enum: NORMAL_BALANCE_VALUES,
      default: "DEBIT",
      uppercase: true,
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: [0, "Current balance cannot be negative"],
    },
    currentBalanceType: {
      type: String,
      enum: NORMAL_BALANCE_VALUES,
      default: "DEBIT",
      uppercase: true,
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
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      branchName: { type: String, trim: true },
    },
    gstDetails: {
      gstin: { type: String, trim: true, uppercase: true },
      registrationType: { type: String, trim: true },
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

ledgerSchema.index({ groupId: 1, isActive: 1 });
ledgerSchema.index({ ledgerType: 1, isActive: 1 });
ledgerSchema.index({ partyId: 1, partyType: 1 });

export default mongoose.model("Ledger", ledgerSchema);
