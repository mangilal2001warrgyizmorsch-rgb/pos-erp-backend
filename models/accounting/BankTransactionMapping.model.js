import mongoose from "mongoose";

const bankTransactionMappingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
    },
    pattern: {
      type: String,
      required: [true, "Narration pattern is required"],
      uppercase: true,
      trim: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      required: [true, "Mapped ledger is required"],
    },
    ledgerName: {
      type: String,
      required: true,
    },
    groupType: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      default: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Unique pattern per company profile
bankTransactionMappingSchema.index({ companyId: 1, pattern: 1 }, { unique: true });
bankTransactionMappingSchema.index({ pattern: 1 });

export default mongoose.model("BankTransactionMapping", bankTransactionMappingSchema);
