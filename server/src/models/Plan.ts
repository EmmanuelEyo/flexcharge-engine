import mongoose, { Schema, Document, Types } from "mongoose";
import type { PlanInterval } from "../types/subscription.types.js";
import { PLAN_INTERVALS } from "../types/subscription.types.js";

/**
 * Plan Model — defines billing plan configurations.
 *
 * Amounts are stored in KOBO (smallest currency unit).
 * e.g., ₦5,000 = 500000 kobo
 *
 * This prevents floating-point arithmetic errors in financial calculations.
 *
 * Per implementation_plan.md §3.4
 */
export interface IPlan extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  intervalDays?: number;
  trialDays: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      maxlength: [100, "Plan name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },
    interval: {
      type: String,
      required: [true, "Billing interval is required"],
      enum: {
        values: PLAN_INTERVALS,
        message: "Interval must be one of: weekly, monthly, quarterly, yearly",
      },
    },
    intervalDays: {
      type: Number,
      min: [1, "Interval days must be at least 1"],
    },
    trialDays: {
      type: Number,
      default: 0,
      min: [0, "Trial days cannot be negative"],
    },
    features: {
      type: [String],
      default: [],
    },
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

// Compound unique index: tenant can't have two plans with the same slug
planSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

/**
 * Pre-validate: auto-generate slug from plan name if not provided.
 * "Pro Monthly Plan" → "pro-monthly-plan"
 */
planSchema.pre("validate", function () {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

export const Plan = mongoose.model<IPlan>("Plan", planSchema);
