import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWalletGroup extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  isDefault: boolean;

  // Configuration boundaries in KOBO
  minAutoTopUpAmount?: number;
  maxAutoTopUpAmount?: number;
  minAutoTopUpTrigger?: number;
  maxAutoTopUpTrigger?: number;

  createdAt: Date;
  updatedAt: Date;
}

const walletGroupSchema = new Schema<IWalletGroup>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    minAutoTopUpAmount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
    },
    maxAutoTopUpAmount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
    },
    minAutoTopUpTrigger: {
      type: Number,
      min: [0, "Trigger cannot be negative"],
    },
    maxAutoTopUpTrigger: {
      type: Number,
      min: [0, "Trigger cannot be negative"],
    },
  },
  { timestamps: true }
);

export const WalletGroup = mongoose.model<IWalletGroup>("WalletGroup", walletGroupSchema);
