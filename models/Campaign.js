import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    messageTemplate: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String, // Optional URL for Image/PDF
    },
    targetAudience: {
      type: String,
      enum: ["all_customers", "top_spenders", "inactive", "custom"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "processing", "completed", "failed"],
      default: "draft",
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    successfulDeliveries: {
      type: Number,
      default: 0,
    },
    failedDeliveries: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    scheduledFor: {
      type: Date, // For future scheduling
    },
  },
  { timestamps: true }
);

export default mongoose.model("Campaign", campaignSchema);
