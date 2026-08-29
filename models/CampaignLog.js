import mongoose from "mongoose";

const campaignLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
    },
    errorMessage: {
      type: String,
    },
    messageId: {
      type: String, // WhatsApp or Twilio returned message ID
    },
  },
  { timestamps: true }
);

// Indexing for faster queries on dashboards
campaignLogSchema.index({ campaignId: 1, status: 1 });

export default mongoose.model("CampaignLog", campaignLogSchema);
