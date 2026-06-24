import mongoose, { Schema, Document, Types } from "mongoose";
import type { WebhookDeliveryStatus, WebhookEvent } from "../types/subscription.types.js";
import { WEBHOOK_DELIVERY_STATUSES, WEBHOOK_EVENTS } from "../types/subscription.types.js";

/**
 * WebhookDelivery Model — tracks outgoing webhook events sent to downstream tenants.
 *
 * Every time an event occurs (e.g. subscription.created, payment.failed),
 * we create a WebhookDelivery record and queue it for dispatch via Agenda.
 *
 * Per implementation_plan.md §3.8 and §9
 */
export interface IWebhookDelivery extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  url: string;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: string;
  createdAt: Date;
}

const webhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      enum: WEBHOOK_EVENTS,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: WEBHOOK_DELIVERY_STATUSES,
      default: "pending",
    },
    httpStatus: {
      type: Number,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastAttemptAt: {
      type: Date,
    },
    nextRetryAt: {
      type: Date,
    },
    response: {
      type: String,
      maxlength: 1000, // Truncate response bodies to prevent bloat
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

// Index for finding pending deliveries that need retry
webhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });

export const WebhookDelivery = mongoose.model<IWebhookDelivery>(
  "WebhookDelivery",
  webhookDeliverySchema
);
