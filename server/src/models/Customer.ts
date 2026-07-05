import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Customer Model — end users who subscribe to plans.
 *
 * Each customer belongs to exactly one tenant.
 * A customer is identified uniquely by (tenantId + email).
 *
 * Per implementation_plan.md §3.3
 */
export interface ICustomer extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  email: string;
  name?: string;
  phone?: string;
  tokenKey?: string;
  cardLast4?: string;
  cardBrand?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Customer email is required"],
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },
    tokenKey: { type: String, trim: true },
    cardLast4: { type: String, trim: true },
    cardBrand: { type: String, trim: true },
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
        delete obj.__v;
        return obj;
      },
    },
  }
);

// Compound unique index: each tenant can only have one customer per email
customerSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
