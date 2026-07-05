import mongoose, { Schema, Document, Types } from "mongoose";

export type EmailStatus = "pending" | "processing" | "completed" | "failed";

export interface IEmailOutbox extends Document {
  recipientType: "customer" | "tenant";
  type: string;
  tenantId: Types.ObjectId;
  customerId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  failureReason?: string;
  attemptNumber?: number;
  cancellationReason?: string;
  portalUrl?: string;

  status: EmailStatus;
  retries: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailOutboxSchema = new Schema<IEmailOutbox>(
  {
    recipientType: { type: String, enum: ["customer", "tenant"], required: true },
    type: { type: String, required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    failureReason: { type: String },
    attemptNumber: { type: Number },
    cancellationReason: { type: String },
    portalUrl: { type: String },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
      index: true,
    },
    retries: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true }
);

// We add a compound index for efficient FIFO polling
EmailOutboxSchema.index({ status: 1, createdAt: 1 });

export const EmailOutbox = mongoose.model<IEmailOutbox>("EmailOutbox", EmailOutboxSchema);
