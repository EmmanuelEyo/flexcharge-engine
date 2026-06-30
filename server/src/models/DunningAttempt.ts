import mongoose, { Schema, Document, Types } from "mongoose";
import type { DunningStatus } from "../types/subscription.types.js";
import { DUNNING_STATUSES } from "../types/subscription.types.js";

/**
 * DunningAttempt Model — tracks each retry for a failed payment.
 *
 * When a subscription payment fails, the billing engine creates a
 * DunningAttempt record and schedules a retry via Agenda. Each attempt
 * is logged with its outcome, decline classification, and retry strategy.
 *
 * The Smart Dunning feature (Feature 3 from feature_implementation_blueprint.md)
 * extends this model with decline code classification fields to support
 * payday-aligned retry scheduling.
 *
 * Per overall_implementation_plan.md §3.7 and feature_implementation_blueprint.md §3
 */
export interface IDunningAttempt extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  attemptNumber: number;
  scheduledFor: Date;
  executedAt?: Date;
  status: DunningStatus;
  failureReason?: string;
  nextRetryAt?: Date;

  // === SMART DUNNING FIELDS (Feature 3) ===
  declineCode?: string;       // ISO 8583 code from Nomba (e.g. "51")
  declineCategory?: string;   // Classification (e.g. "insufficient_funds")
  declineType?: string;       // "soft" or "hard"
  retryStrategy?: string;     // "payday_aligned", "immediate", "none"

  createdAt: Date;
}

const dunningAttemptSchema = new Schema<IDunningAttempt>(
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
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: [1, "Attempt number must be at least 1"],
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    executedAt: { type: Date },
    status: {
      type: String,
      required: true,
      enum: {
        values: DUNNING_STATUSES,
        message: "Status must be one of: scheduled, succeeded, failed, skipped",
      },
      default: "scheduled",
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Failure reason cannot exceed 1000 characters"],
    },
    nextRetryAt: { type: Date },

    // === SMART DUNNING FIELDS ===
    declineCode: {
      type: String,
      trim: true,
    },
    declineCategory: {
      type: String,
      trim: true,
    },
    declineType: {
      type: String,
      enum: ["soft", "hard"],
    },
    retryStrategy: {
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

// Query: find pending dunning attempts for scheduling
dunningAttemptSchema.index({ status: 1, scheduledFor: 1 });

// Query: find all dunning attempts for a subscription (history view)
dunningAttemptSchema.index({ subscriptionId: 1, attemptNumber: 1 });

export const DunningAttempt = mongoose.model<IDunningAttempt>(
  "DunningAttempt",
  dunningAttemptSchema
);
