import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty
          return /^\S+@\S+\.\S+$/.test(v);
        },
        message: "Please provide a valid email"
      }
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        },
        message: "Invalid Indian GST Number"
      }
    },
    state: {
      type: String, // E.g. "Maharashtra", "Gujarat"
      trim: true,
    },
    stateCode: {
      type: String, // GST state code e.g. "27"
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters"],
    },
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    openingBalanceType: {
      type: String,
      enum: ["Payable", "Receivable"],
      default: "Receivable",
    },
    openingBalanceDate: {
      type: Date,
      default: Date.now,
    },
    // Digital Khaata / Ledger Tracking Fields
    currentBalance: {
      type: Number,
      default: 0,
      description: "Positive means customer owes us. Negative means we owe customer.",
    },
    creditDays: {
      type: Number,
      default: 30,
    },
    isAutoReminderEnabled: {
      type: Boolean,
      default: false,
    },
    lastReminderSentAt: {
      type: Date,
    },
    accountingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ accountingLedgerId: 1 });

export default mongoose.model("Customer", customerSchema);
