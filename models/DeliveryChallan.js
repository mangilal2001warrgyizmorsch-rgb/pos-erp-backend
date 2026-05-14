import mongoose from 'mongoose';

const challanItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: String,
  quantity: {
    type: Number,
    required: true,
  },
  unit: String,
});

const deliveryChallanSchema = new mongoose.Schema(
  {
    challanNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    items: [challanItemSchema],
    status: {
      type: String,
      enum: ['draft', 'sent', 'delivered', 'invoiced', 'cancelled'],
      default: 'sent',
    },
    vehicleNumber: String,
    driverName: String,
    driverPhone: String,
    deliveryDate: Date,
    notes: String,
    totalQuantity: Number,
    relatedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('DeliveryChallan', deliveryChallanSchema);
