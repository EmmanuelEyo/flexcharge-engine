import { Types } from "mongoose";
import axios from "axios";
import { Tenant } from "../models/Tenant.js";
import { WebhookDelivery, IWebhookDelivery } from "../models/WebhookDelivery.js";
import { signPayload } from "../utils/hmac.js";
import { logger } from "../utils/logger.js";
import type { WebhookEvent } from "../types/subscription.types.js";

/**
 * Webhook Service — handles outgoing webhook dispatch to downstream tenants.
 *
 * Flow:
 * 1. An event occurs (e.g., subscription.created)
 * 2. Call `queueWebhook()` to create a WebhookDelivery record
 * 3. The Agenda job `deliver-webhook` picks it up and calls `deliverWebhook()`
 * 4. On failure, `scheduleRetry()` queues the next attempt with exponential backoff
 *
 * Per implementation_plan.md §9
 */

/**
 * Exponential backoff intervals for retries (in milliseconds).
 * Attempt 1: 1 minute
 * Attempt 2: 5 minutes
 * Attempt 3: 30 minutes
 * Attempt 4: 2 hours
 * Attempt 5: 24 hours
 */
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,       // 1 min
  5 * 60 * 1000,       // 5 min
  30 * 60 * 1000,      // 30 min
  2 * 60 * 60 * 1000,  // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
];

/**
 * Queue a webhook event for delivery.
 * Creates a WebhookDelivery record and returns it.
 * The actual HTTP dispatch is handled by the Agenda job.
 *
 * @param tenantId - The tenant to notify
 * @param event - The event type (e.g., "subscription.created")
 * @param data - The event payload data
 * @returns The created WebhookDelivery document (or null if tenant has no webhook URL)
 */
export async function queueWebhook(
  tenantId: Types.ObjectId,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<IWebhookDelivery | null> {
  const tenant = await Tenant.findById(tenantId).select(
    "webhookUrl webhookSecret"
  );

  // If the tenant hasn't configured a webhook URL, skip silently
  if (!tenant?.webhookUrl) {
    logger.debug(
      { tenantId, event },
      "Skipping webhook — tenant has no webhook URL configured"
    );
    return null;
  }

  const payload = {
    id: `evt_${new Types.ObjectId().toString()}`,
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const delivery = await WebhookDelivery.create({
    tenantId,
    event,
    payload,
    url: tenant.webhookUrl,
    status: "pending",
  });

  logger.info(
    { tenantId, event, deliveryId: delivery._id },
    "Webhook queued for delivery"
  );

  return delivery;
}

/**
 * Deliver a webhook event via HTTP POST.
 * Signs the payload with HMAC-SHA256 using the tenant's webhook secret.
 *
 * @param deliveryId - The WebhookDelivery document ID
 * @returns true if delivery succeeded, false if it failed
 */
export async function deliverWebhook(
  deliveryId: Types.ObjectId
): Promise<boolean> {
  const delivery = await WebhookDelivery.findById(deliveryId);
  if (!delivery) {
    logger.error({ deliveryId }, "Webhook delivery record not found");
    return false;
  }

  const tenant = await Tenant.findById(delivery.tenantId).select(
    "webhookSecret"
  );
  if (!tenant) {
    logger.error(
      { deliveryId, tenantId: delivery.tenantId },
      "Tenant not found for webhook delivery"
    );
    delivery.status = "failed";
    await delivery.save();
    return false;
  }

  const payloadString = JSON.stringify(delivery.payload);
  const timestamp = Date.now().toString();
  const signature = signPayload(`${timestamp}.${payloadString}`, tenant.webhookSecret);

  try {
    const response = await axios.post(delivery.url, delivery.payload, {
      headers: {
        "Content-Type": "application/json",
        "x-flexcharge-signature": signature,
        "x-flexcharge-timestamp": timestamp,
        "x-flexcharge-event": delivery.event,
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true, // Don't throw on non-2xx
    });

    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date();
    delivery.httpStatus = response.status;
    delivery.response = JSON.stringify(response.data).substring(0, 1000);

    if (response.status >= 200 && response.status < 300) {
      // Success
      delivery.status = "delivered";
      await delivery.save();

      logger.info(
        {
          deliveryId: delivery._id,
          event: delivery.event,
          httpStatus: response.status,
        },
        "Webhook delivered successfully"
      );
      return true;
    }

    // Non-2xx response — schedule retry if we haven't exceeded max attempts
    logger.warn(
      {
        deliveryId: delivery._id,
        event: delivery.event,
        httpStatus: response.status,
        attempt: delivery.attempts,
      },
      "Webhook delivery received non-2xx response"
    );

    return await handleDeliveryFailure(delivery);
  } catch (error) {
    // Network error, timeout, etc.
    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date();
    delivery.response = error instanceof Error ? error.message : "Unknown error";

    logger.error(
      {
        deliveryId: delivery._id,
        event: delivery.event,
        attempt: delivery.attempts,
        error: delivery.response,
      },
      "Webhook delivery failed with network error"
    );

    return await handleDeliveryFailure(delivery);
  }
}

/**
 * Handle a failed delivery attempt.
 * Schedules a retry with exponential backoff or marks as permanently failed.
 */
async function handleDeliveryFailure(
  delivery: IWebhookDelivery
): Promise<false> {
  if (delivery.attempts >= delivery.maxAttempts) {
    delivery.status = "failed";
    delivery.nextRetryAt = undefined;
    await delivery.save();

    logger.error(
      {
        deliveryId: delivery._id,
        event: delivery.event,
        totalAttempts: delivery.attempts,
      },
      "Webhook delivery permanently failed — max attempts exceeded"
    );
    return false;
  }

  // Schedule retry with exponential backoff
  const delayMs =
    RETRY_DELAYS_MS[delivery.attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  delivery.nextRetryAt = new Date(Date.now() + delayMs);
  await delivery.save();

  logger.info(
    {
      deliveryId: delivery._id,
      event: delivery.event,
      nextRetryAt: delivery.nextRetryAt,
      attempt: delivery.attempts,
    },
    "Webhook delivery retry scheduled"
  );

  return false;
}
