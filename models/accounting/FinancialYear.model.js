import mongoose from "mongoose";

const financialYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Financial year name is required"],
      unique: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Financial year start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Financial year end date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    closedAt: Date,
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

financialYearSchema.pre("validate", function validateFinancialYearDates(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error("Financial year end date must be after start date"));
  }

  return next();
});

financialYearSchema.index({ isActive: 1, isClosed: 1 });

export default mongoose.model("FinancialYear", financialYearSchema);
