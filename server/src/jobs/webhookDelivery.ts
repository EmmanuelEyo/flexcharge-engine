import { Types } from "mongoose";
import type { Agenda } from "agenda";
import { deliverWebhook } from "../services/webhook.service.js";
import { WebhookDelivery } from "../models/WebhookDelivery.js";
import { logger } from "../utils/logger.js";

/**
 * Agenda job definitions for webhook delivery.
 *
 * Jobs:
 * 1. `deliver-webhook` — Deliver a single webhook event
 * 2. `retry-pending-webhooks` — Scan for failed deliveries due for retry
 *
 * Per implementation_plan.md §8
 */

export function defineWebhookJobs(agenda: Agenda): void {
  /**
   * Job: deliver-webhook
   * Triggered when a new webhook event is queued.
   * Receives the WebhookDelivery ID and attempts to deliver it.
   */
  agenda.define("deliver-webhook", async (job) => {
    const { deliveryId } = job.attrs.data as { deliveryId: string };

    logger.debug({ deliveryId }, "Executing webhook delivery job");

    await deliverWebhook(new Types.ObjectId(deliveryId));
  });

  /**
   * Job: retry-pending-webhooks
   * Runs on a schedule (e.g., every 1 minute).
   * Finds webhook deliveries that failed and are due for retry,
   * then schedules individual `deliver-webhook` jobs for each.
   */
  agenda.define("retry-pending-webhooks", async (_job) => {
    const now = new Date();

    const pendingRetries = await WebhookDelivery.find({
      status: "pending",
      nextRetryAt: { $lte: now },
      $expr: { $lt: ["$attempts", "$maxAttempts"] },
    }).limit(50); // Process max 50 retries per scan

    if (pendingRetries.length === 0) return;

    logger.info(
      { count: pendingRetries.length },
      "Found webhook deliveries due for retry"
    );

    for (const delivery of pendingRetries) {
      await agenda.now("deliver-webhook", {
        deliveryId: delivery._id.toString(),
      });
    }
  });
}
