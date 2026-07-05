import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Wallet Model — Credit wallet for usage-based billing.
 *
 * Each wallet belongs to a customer within a tenant's scope.
 * Balance is stored in KOBO (integers) per AGENTS.md §3.
 *
 * The wallet supports:
 * - Manual and automatic top-ups
 * - Atomic credit deductions
 * - Low balance threshold alerts
 * - Auto-refill when balance is depleted
 *
 * Per AGENTS.md §4.1: "Real-time consumption ledger in models/Wallet.ts
 * and auto-refill triggers."
 *
 * Per feature_implementation_blueprint.md §1
 */
export interface IWallet extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  customerId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  walletGroupId?: Types.ObjectId;

  balance: number;               // Current credit balance in KOBO
  currency: string;              // "NGN"
  lowBalanceThreshold: number;   // Alert when balance drops below this (KOBO)

  // === AUTO TOP-UP CONFIG ===
  autoTopUp: boolean;
  autoTopUpAmount?: number;      // Amount to recharge in KOBO
  autoTopUpTrigger?: number;     // Trigger auto top-up when balance drops below this (KOBO)

  autoTopUpConsentedAt?: Date;
  autoTopUpConsentedIp?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
    walletGroupId: {
      type: Schema.Types.ObjectId,
      ref: "WalletGroup",
      index: true,
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Balance cannot be negative"],
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
    lowBalanceThreshold: {
      type: Number,
      default: 0,
      min: [0, "Threshold cannot be negative"],
    },

    // === AUTO TOP-UP ===
    autoTopUp: {
      type: Boolean,
      default: false,
    },
    autoTopUpAmount: {
      type: Number,
      min: [0, "Auto top-up amount cannot be negative"],
    },
    autoTopUpTrigger: {
      type: Number,
      min: [0, "Auto top-up trigger cannot be negative"],
    },
    autoTopUpConsentedAt: Date,
    autoTopUpConsentedIp: { type: String, trim: true },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
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

// Each customer can have one wallet per tenant
walletSchema.index({ tenantId: 1, customerId: 1 }, { unique: true });

// Find wallets linked to a subscription
walletSchema.index({ subscriptionId: 1 }, { sparse: true });

export const Wallet = mongoose.model<IWallet>("Wallet", walletSchema);
