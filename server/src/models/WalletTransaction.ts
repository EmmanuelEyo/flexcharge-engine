import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * WalletTransaction Model — Append-only ledger for wallet operations.
 *
 * Tracks every credit or debit operation on a wallet to provide an
 * immutable audit trail.
 *
 * Amounts are stored in KOBO (integers) per AGENTS.md §3.
 *
 * Per feature_implementation_blueprint.md §1
 */
export interface IWalletTransaction extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  walletId: Types.ObjectId;
  customerId: Types.ObjectId;

  type: "credit" | "debit";
  amount: number;         // Amount added/removed in KOBO
  balanceAfter: number;   // Balance after this transaction
  currency: string;       // "NGN"

  description: string;
  referenceId?: string;   // E.g., Invoice ID for a top-up, or usage event ID

  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    type: {
      type: String,
      required: true,
      enum: ["credit", "debit"],
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Transaction amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer (kobo). Got: {VALUE}",
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, "Balance after cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Balance must be an integer (kobo). Got: {VALUE}",
      },
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    referenceId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only, no updates
    toJSON: {
      transform(_doc, ret) {
        const obj = ret as any;
        delete obj.__v;
        return obj;
      },
    },
  }
);

// === INDEXES ===

// Query: get transaction history for a wallet, sorted by latest
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  "WalletTransaction",
  walletTransactionSchema
);
