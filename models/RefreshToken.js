import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
  replacedByToken: {
    type: String,
  },
}, {
  timestamps: true,
});

// Virtual for checking if token is expired
refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expiresAt;
});

// Virtual for checking if token is active
refreshTokenSchema.virtual('isActive').get(function () {
  return !this.revoked && !this.isExpired;
});

export default mongoose.model('RefreshToken', refreshTokenSchema);
