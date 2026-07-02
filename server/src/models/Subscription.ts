import mongoose, { Schema, Document, Types } from "mongoose";
import type { SubscriptionStatus } from "../types/subscription.types.js";
import { SUBSCRIPTION_STATUSES } from "../types/subscription.types.js";

/**
 * Subscription Model — the core entity linking a customer to a plan.
 *
 * State machine transitions:
 *   pending   → trialing | active | canceled
 *   trialing  → active | canceled
 *   active    → past_due | paused | canceled
 *   past_due  → active | unpaid | canceled
 *   paused    → active | canceled
 *   unpaid    → active | canceled
 *   canceled  → (terminal state)
 *
 * Amounts are referenced from the Plan model and stored in KOBO (integers).
 *
 * Per overall_implementation_plan.md §3.5 and AGENTS.md §3
 */
export interface ISubscription extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  customerId: Types.ObjectId;
  planId: Types.ObjectId;

  // === STATE MACHINE ===
  status: SubscriptionStatus;

  // === RENEWAL MODE ===
  renewalMode: "auto" | "manual";

  // === NOMBA TOKEN (populated after successful checkout) ===
  tokenKey?: string;
  cardLast4?: string;
  cardBrand?: string;

  // === BILLING PERIODS ===
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  nextBillingDate?: Date;
  trialEnd?: Date;

  // === CANCELLATION ===
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  cancellationReason?: string;

  // === DUNNING ===
  dunningAttemptCount: number;
  lastDunningAt?: Date;

  // === CHECKOUT ===
  nombaCheckoutOrderRef?: string;
  checkoutLink?: string;

  // === META ===
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Valid state transitions enforced at the application layer.
 * The key is the current status; the value is the array of valid next statuses.
 */
export const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  pending:   ["trialing", "active", "canceled"],
  trialing:  ["active", "canceled"],
  active:    ["past_due", "paused", "canceled"],
  past_due:  ["active", "unpaid", "canceled"],
  paused:    ["active", "canceled"],
  unpaid:    ["active", "canceled"],
  canceled:  [], // terminal state — no transitions out
};

const subscriptionSchema = new Schema<ISubscription>(
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
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    // === STATE MACHINE ===
    status: {
      type: String,
      required: true,
      enum: {
        values: SUBSCRIPTION_STATUSES,
        message: "Status must be one of: pending, trialing, active, past_due, canceled, unpaid, paused",
      },
      default: "pending",
    },

    // === RENEWAL MODE ===
    renewalMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },

    // === NOMBA TOKEN ===
    tokenKey: {
      type: String,
      trim: true,
    },
    cardLast4: {
      type: String,
      trim: true,
      maxlength: [4, "cardLast4 must be exactly 4 characters"],
    },
    cardBrand: {
      type: String,
      trim: true,
    },

    // === BILLING PERIODS ===
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    nextBillingDate: { type: Date },
    trialEnd: { type: Date },

    // === CANCELLATION ===
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: { type: Date },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },

    // === DUNNING ===
    dunningAttemptCount: {
      type: Number,
      default: 0,
      min: [0, "Dunning attempt count cannot be negative"],
    },
    lastDunningAt: { type: Date },

    // === CHECKOUT ===
    nombaCheckoutOrderRef: {
      type: String,
      trim: true,
    },
    checkoutLink: {
      type: String,
      trim: true,
    },

    // === META ===
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const obj = ret as any;
        // SECURITY: Never expose tokenKey in API responses
        delete obj.tokenKey;
        delete obj.__v;
        return obj;
      },
    },
  }
);

// === INDEXES ===

// Query: find subscriptions for a tenant by status (billing scan, dashboard views)
subscriptionSchema.index({ tenantId: 1, status: 1 });

// Query: daily billing scan — find active subscriptions due for renewal
subscriptionSchema.index({ nextBillingDate: 1, status: 1 });

// Query: find all subscriptions for a specific customer


// Query: look up subscription by Nomba checkout reference (webhook processing)
subscriptionSchema.index({ nombaCheckoutOrderRef: 1 }, { sparse: true });

/**
 * Pre-save hook: Validate state transitions.
 * Prevents invalid status changes (e.g., canceled → active without explicit logic).
 */
subscriptionSchema.pre("save", function () {
  if (this.isModified("status") && !this.isNew) {
    const previousStatus = (this as any)._previousStatus as SubscriptionStatus | undefined;
    // _previousStatus must be set by the caller before saving
    // If not set, we skip validation (for programmatic admin overrides)
    if (previousStatus) {
      const allowedTransitions = VALID_TRANSITIONS[previousStatus];
      if (allowedTransitions && !allowedTransitions.includes(this.status)) {
        throw new Error(
          `Invalid subscription state transition: ${previousStatus} → ${this.status}. ` +
          `Allowed transitions from "${previousStatus}": [${allowedTransitions.join(", ")}]`
        );
      }
    }
  }
});

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);
