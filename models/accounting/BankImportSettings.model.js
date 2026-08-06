import mongoose from "mongoose";

const bankImportSettingsSchema = new mongoose.Schema(
  {
    defaultBankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultExpenseLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    autoPostEnabled: {
      type: Boolean,
      default: false,
    },
    confidenceThreshold: {
      type: Number,
      default: 90,
    },
    bankMappings: [
      {
        keyword: { type: String, uppercase: true, trim: true }, // e.g. HDFC, SBI, AXIS
        bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger" }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("BankImportSettings", bankImportSettingsSchema);
