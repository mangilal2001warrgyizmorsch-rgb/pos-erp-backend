import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema(
  {
    whatsapp: {
      provider: { type: String, enum: ['twilio', 'meta', 'wati', 'kapso'], default: 'twilio' },
      isActive: { type: Boolean, default: false },
      twilioSid: { type: String },
      twilioAuthToken: { type: String },
      twilioNumber: { type: String },
      twilioContentSid: { type: String },
      kapsoApiKey: { type: String },
      kapsoPhoneNumberId: { type: String },
    },
    email: {
      provider: { type: String, enum: ['smtp', 'sendgrid'], default: 'smtp' },
      isActive: { type: Boolean, default: false },
      host: { type: String },
      port: { type: Number },
      user: { type: String },
      password: { type: String },
    }
  },
  { timestamps: true }
);

export default mongoose.model('Integration', integrationSchema);
