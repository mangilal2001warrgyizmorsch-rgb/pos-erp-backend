import mongoose from "mongoose";

const businessProfileSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    tagline: { type: String },
    phone: { type: String },
    email: { type: String },
    gstin: { type: String },
    address: { type: String },
    businessType: { type: String },
    category: { type: String },
    state: { type: String },
    stateCode: { type: String },
    pincode: { type: String },
    logo: { type: String },
    signature: { type: String },
    beginningDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("BusinessProfile", businessProfileSchema);
