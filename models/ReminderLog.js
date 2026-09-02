import mongoose from "mongoose";

const reminderLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartyLedger",
    },
    message: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "failed"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  }
);

reminderLogSchema.index({ customerId: 1 });

export default mongoose.model("ReminderLog", reminderLogSchema);
