import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITenantLedger extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  availableBalance: number; // Stored in KOBO
  totalWithdrawn: number;   // Stored in KOBO
  createdAt: Date;
  updatedAt: Date;
}

const tenantLedgerSchema = new Schema<ITenantLedger>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
      index: true,
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: [0, "Ledger balance cannot be negative"],
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const TenantLedger = mongoose.model<ITenantLedger>("TenantLedger", tenantLedgerSchema);
