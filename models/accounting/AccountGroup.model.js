import mongoose from "mongoose";
import {
  ACCOUNT_NATURE_VALUES,
  NORMAL_BALANCE_VALUES,
} from "../../constants/accounting.constants.js";

const accountGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Account group name is required"],
      trim: true,
      maxlength: [120, "Account group name cannot exceed 120 characters"],
    },
    code: {
      type: String,
      required: [true, "Account group code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [40, "Account group code cannot exceed 40 characters"],
    },
    parentGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountGroup",
    },
    nature: {
      type: String,
      required: [true, "Account nature is required"],
      enum: ACCOUNT_NATURE_VALUES,
      uppercase: true,
    },
    normalBalance: {
      type: String,
      required: [true, "Normal balance is required"],
      enum: NORMAL_BALANCE_VALUES,
      uppercase: true,
    },
    affectsGrossProfit: {
      type: Boolean,
      default: false,
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

accountGroupSchema.index({ parentGroupId: 1 });
accountGroupSchema.index({ nature: 1, isActive: 1 });

export default mongoose.model("AccountGroup", accountGroupSchema);
