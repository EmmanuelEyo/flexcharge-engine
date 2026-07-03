import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAnalyticsSnapshot extends Document {
  tenantId: Types.ObjectId;
  date: Date;
  mrr: number; // in Kobo
  arr: number; // in Kobo
  activeSubscribers: number;
  churnRate: number; // percentage (e.g., 5.5 for 5.5%)
  arpu: number; // in Kobo
  dailyRevenue: number; // in Kobo
  dailyFailedRevenue: number; // in Kobo
  dailyWalletConsumption: number; // in Kobo
  createdAt: Date;
}

const analyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    mrr: { type: Number, default: 0 },
    arr: { type: Number, default: 0 },
    activeSubscribers: { type: Number, default: 0 },
    churnRate: { type: Number, default: 0 },
    arpu: { type: Number, default: 0 },
    dailyRevenue: { type: Number, default: 0 },
    dailyFailedRevenue: { type: Number, default: 0 },
    dailyWalletConsumption: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        const obj = ret as any;
        delete obj.__v;
        return obj;
      },
    },
  }
);

// Ensure we only have one snapshot per tenant per day
analyticsSnapshotSchema.index({ tenantId: 1, date: 1 }, { unique: true });

export const AnalyticsSnapshot = mongoose.model<IAnalyticsSnapshot>(
  "AnalyticsSnapshot",
  analyticsSnapshotSchema
);
