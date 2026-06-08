import mongoose from "mongoose";

const accountingSettingsSchema = new mongoose.Schema(
  {
    accountingEnabled: {
      type: Boolean,
      default: false,
    },
    gstAccountingEnabled: {
      type: Boolean,
      default: false,
    },
    inventoryAccountingEnabled: {
      type: Boolean,
      default: false,
    },
    autoVoucherPosting: {
      type: Boolean,
      default: true,
    },
    allowManualJournalEntry: {
      type: Boolean,
      default: false,
    },
    allowBackdatedVouchers: {
      type: Boolean,
      default: true,
    },
    lockBooksTillDate: Date,
    defaultCashLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultBankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultSalesLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultPurchaseLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultSalesReturnLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultPurchaseReturnLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultRoundOffLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultDiscountGivenLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultDiscountReceivedLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultStockLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    defaultCOGSLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
  },
  { timestamps: true },
);

export default mongoose.model("AccountingSettings", accountingSettingsSchema);
