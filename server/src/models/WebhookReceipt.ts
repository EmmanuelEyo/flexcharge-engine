import mongoose, { Schema, Document } from "mongoose";

/**
 * WebhookReceipt Model — stores a record of every inbound Nomba webhook
 * delivery, keyed by `requestId`, to enforce strict idempotency.
 *
 * Purpose:
 *   Before processing any webhook payload, we attempt an upsert/insert
 *   into this collection. If the `requestId` already exists (unique index),
 *   the insert fails with a duplicate-key error (11000), and we no-op
 *   the webhook — returning 200 OK without further state mutations.
 *
 * TTL:
 *   Records auto-expire after 7 days to prevent unbounded collection growth.
 *   This is safe because Nomba's webhook retry window is much shorter.
 */
export interface IWebhookReceipt extends Document {
  /** The unique requestId from the Nomba webhook payload */
  requestId: string;
  /** The event_type from the Nomba webhook payload (e.g. "payment_success") */
  eventType: string;
  /** Extracted orderReference for debugging/audit purposes */
  orderReference?: string;
  /** Processing status — "received" on insert, "processed" after completion */
  status: "received" | "processed" | "failed";
  /** Timestamp of first receipt */
  receivedAt: Date;
}

const webhookReceiptSchema = new Schema<IWebhookReceipt>(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    orderReference: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["received", "processed", "failed"],
      default: "received",
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Unique index on requestId — the core idempotency constraint.
// MongoDB will reject duplicate inserts with error code 11000.
webhookReceiptSchema.index({ requestId: 1 }, { unique: true });

// TTL index — auto-delete receipts after 7 days to prevent unbounded growth.
webhookReceiptSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const WebhookReceipt = mongoose.model<IWebhookReceipt>(
  "WebhookReceipt",
  webhookReceiptSchema
);
