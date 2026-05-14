import mongoose from 'mongoose';

const loanSchema = new mongoose.Schema({
  loanName: {
    type: String,
    required: true,
  },
  lenderName: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  interestRate: {
    type: Number,
    required: true,
  },
  currentBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Active', 'Closed'],
    default: 'Active',
  }
}, {
  timestamps: true,
});

const Loan = mongoose.model('Loan', loanSchema);

export default Loan;
