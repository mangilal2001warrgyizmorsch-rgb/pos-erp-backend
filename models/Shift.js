import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    counter: {
      type: String, // E.g. "Main Counter", "Counter 2"
      default: 'Main Counter',
    },
    openingTime: {
      type: Date,
      default: Date.now,
    },
    closingTime: {
      type: Date,
    },
    openingCash: {
      type: Number,
      required: true,
      default: 0,
    },
    closingCash: {
      type: Number,
    },
    expectedCash: {
      type: Number, // Calculated: openingCash + totalSalesCash + cashIn - cashOut
    },
    actualCash: {
      type: Number, // Entered by cashier at closing
    },
    difference: {
      type: Number, // actualCash - expectedCash
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    totalSalesCash: {
      type: Number,
      default: 0,
    },
    totalSalesCard: {
      type: Number,
      default: 0,
    },
    totalSalesUpi: {
      type: Number,
      default: 0,
    },
    totalExpenses: {
      type: Number,
      default: 0,
    },
    cashIn: {
      type: Number,
      default: 0,
    },
    cashOut: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
shiftSchema.index({ cashier: 1, status: 1 });
shiftSchema.index({ openingTime: -1 });

export default mongoose.model('Shift', shiftSchema);
