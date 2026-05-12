import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  purchasePrice: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    transporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transporter',
    },
    invoiceNumber: {
      type: String, // Supplier's invoice number
      trim: true,
    },
    items: [purchaseItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'partial'],
      default: 'paid',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'received', 'cancelled', 'returned'],
      default: 'confirmed',
    },
    notes: {
      type: String,
      trim: true,
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

// Generate purchase number before validation
purchaseSchema.pre('validate', async function (next) {
  if (!this.purchaseNumber) {
    const count = await mongoose.model('Purchase').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.purchaseNumber = `PUR-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('Purchase', purchaseSchema);
