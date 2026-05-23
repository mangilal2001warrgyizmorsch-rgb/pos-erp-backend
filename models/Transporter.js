import mongoose from 'mongoose';

const transporterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Transporter name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    vehicleNumber: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^(?:\+91|0)?[6-9]\d{9}$/, 'Please provide a valid Indian mobile number'],
    },
    address: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Transporter', transporterSchema);
