import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILedgerTransaction extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  type: "CREDIT" | "DEBIT";
  amount: number; // Stored in KOBO
  description: string;
  referenceId: string; // E.g., Invoice ID, Withdrawal TxRef, Refund TxRef
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
}

const ledgerTransactionSchema = new Schema<ILedgerTransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than 0"], // Must be at least 1 KOBO
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    referenceId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "SUCCESS", // Default to SUCCESS for direct credits
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying tenant history efficiently
ledgerTransactionSchema.index({ tenantId: 1, createdAt: -1 });

export const LedgerTransaction = mongoose.model<ILedgerTransaction>(
  "LedgerTransaction",
  ledgerTransactionSchema
);
