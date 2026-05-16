import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcategory',
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
    },

    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Threshold cannot be negative'],
    },
    image: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    unit: {
      type: String,
      enum: ["piece", "kg", "liter", "meter", "box", "dozen"],
      default: "piece",
    },
    salesPrice: {
      type: Number,
      default: 0,
    },
    salesTaxType: {
      type: String,
      enum: ["with", "without"],
      default: "without",
    },
    purchasePrice: {
      type: Number,
      default: 0,
    },
    purchaseTaxType: {
      type: String,
      enum: ["with", "without"],
      default: "without",
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    openingStockPrice: {
      type: Number,
      default: 0,
    },
    openingStockDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);



// Virtual for low stock status
productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold;
});

// Index for search
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ stock: 1, lowStockThreshold: 1 });

export default mongoose.model('Product', productSchema);
