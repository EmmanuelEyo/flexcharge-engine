import mongoose, { Schema, Document, Types } from "mongoose";
import type { InvoiceStatus } from "../types/subscription.types.js";
import { INVOICE_STATUSES } from "../types/subscription.types.js";

/**
 * Invoice Model — tracks every charge attempt (successful or failed).
 *
 * Each time we bill a subscription (initial checkout, renewal, or dunning retry),
 * we create an Invoice record. This provides a complete audit trail of all
 * financial transactions.
 *
 * Amounts are stored in KOBO (integers) to prevent floating-point drift.
 * Per AGENTS.md §3: "All financial values must be handled in KOBO (integers only)."
 *
 * Per overall_implementation_plan.md §3.6
 */
export interface IInvoice extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  customerId: Types.ObjectId;

  amount: number;         // Always in KOBO (integer)
  currency: string;       // "NGN"
  status: InvoiceStatus;

  // === NOMBA REFERENCES ===
  nombaOrderReference?: string;
  nombaTransactionId?: string;
  nombaTransactionRef?: string;
  checkoutLink?: string;

  // === DETAILS ===
  description?: string;
  paidAt?: Date;
  failureReason?: string;
  isRenewal: boolean;
  idempotencyKey?: string;

  createdAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: [true, "Invoice amount is required"],
      min: [0, "Amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer (kobo). Got: {VALUE}",
      },
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: INVOICE_STATUSES,
        message: "Status must be one of: pending, paid, failed, refunded",
      },
      default: "pending",
    },

    // === NOMBA REFERENCES ===
    nombaOrderReference: {
      type: String,
      trim: true,
    },
    nombaTransactionId: {
      type: String,
      trim: true,
    },
    nombaTransactionRef: {
      type: String,
      trim: true,
    },
    checkoutLink: {
      type: String,
      trim: true,
    },

    // === DETAILS ===
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    paidAt: { type: Date },
    failureReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Failure reason cannot exceed 1000 characters"],
    },
    isRenewal: {
      type: Boolean,
      default: false,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
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

// === INDEXES ===

// Prevent duplicate charges: idempotencyKey must be unique when present
invoiceSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

// Query: find invoices by tenant and status (dashboard views, reports)
invoiceSchema.index({ tenantId: 1, status: 1 });

// Query: find invoices for a specific subscription (subscription detail page)
invoiceSchema.index({ subscriptionId: 1, createdAt: -1 });

// Query: look up invoice by Nomba order reference (webhook processing)
invoiceSchema.index({ nombaOrderReference: 1 }, { sparse: true });

export const Invoice = mongoose.model<IInvoice>("Invoice", invoiceSchema);
