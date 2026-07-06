import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Customer Model — end users who subscribe to plans.
 *
 * Each customer belongs to exactly one tenant.
 * A customer is identified uniquely by (tenantId + email).
 *
 * Per implementation_plan.md §3.3
 */

/**
 * Represents a single saved payment method on the customer profile.
 * A customer may have multiple methods; one is marked as default.
 */
export interface IPaymentMethod {
  methodType: "card" | "direct_debit";
  isDefault: boolean;

  // Card-specific fields
  tokenKey?: string;
  cardLast4?: string;
  cardBrand?: string;
  tokenExpirationDate?: string; // "MM/YY" format
  expiryReminderSent?: boolean;

  // Direct Debit fields
  mandateId?: string;
  bankCode?: string;
  accountNumberMasked?: string;
  mandateStatus?: "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  email: string;
  name?: string;
  phone?: string;
  tokenKey?: string;
  cardLast4?: string;
  cardBrand?: string;
  paymentMethods: IPaymentMethod[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    methodType: {
      type: String,
      enum: ["card", "direct_debit"],
      required: true,
    },
    isDefault: { type: Boolean, default: false },

    // Card fields
    tokenKey: { type: String, trim: true },
    cardLast4: { type: String, trim: true },
    cardBrand: { type: String, trim: true },
    tokenExpirationDate: { type: String, trim: true },
    expiryReminderSent: { type: Boolean, default: false },

    // Direct Debit fields
    mandateId: { type: String, trim: true },
    bankCode: { type: String, trim: true },
    accountNumberMasked: { type: String, trim: true },
    mandateStatus: {
      type: String,
      enum: ["PENDING", "ACTIVE", "SUSPENDED", "DELETED"],
    },
  },
  { _id: true }
);

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
    paymentMethods: {
      type: [paymentMethodSchema],
      default: [],
    },
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
        // SECURITY: Strip tokenKey from paymentMethods in API responses
        if (Array.isArray(obj.paymentMethods)) {
          obj.paymentMethods = obj.paymentMethods.map((pm: any) => {
            const { tokenKey: _t, ...safe } = pm;
            return safe;
          });
        }
        return obj;
      },
    },
  }
);

// Compound unique index: each tenant can only have one customer per email
customerSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);

