import mongoose from 'mongoose';

const chequeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['received', 'issued'],
    required: true,
  },
  chequeNumber: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  partyName: {
    type: String,
    required: true,
  },
  bankName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Cleared', 'Bounced'],
    default: 'Pending',
  }
}, {
  timestamps: true,
});

const Cheque = mongoose.model('Cheque', chequeSchema);

export default Cheque;
