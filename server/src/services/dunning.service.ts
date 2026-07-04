import { Types } from "mongoose";
import { DunningAttempt } from "../models/DunningAttempt.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { nombaService } from "./nomba.service.js";
import { queueWebhook } from "./webhook.service.js";
import { logger } from "../utils/logger.js";
import { calculateNextBillingDate } from "./billing.service.js";
import { env } from "../config/environment.js";
import { classifyDeclineCode } from "../config/declineCodeMap.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import type { PlanInterval } from "../types/subscription.types.js";

/**
 * Dunning Service — Retry logic for failed payments.
 *
 * Per overall_implementation_plan.md §6.3 (Smart Dunning):
 * - Attempt 1: Immediate (the initial charge failure)
 * - Attempt 2: +1 day
 * - Attempt 3: +3 days
 * - Attempt 4: +7 days
 * - Attempt 5: +14 days (FINAL attempt)
 *
 * If all 5 fail:
 * → Set subscription status = "unpaid"
 * → Deliver webhook: "subscription.unpaid"
 * → Stop charging
 *
 * Smart Dunning Feature (feature_implementation_blueprint.md §3):
 * For "insufficient_funds" declines, align retries with paydays (1st/15th).
 * For "hard" declines (expired card, stolen card), skip dunning entirely.
 *
 * Per AGENTS.md §4.3
 */

const MAX_DUNNING_ATTEMPTS = 5;

/**
 * Default retry intervals in milliseconds.
 * Used for non-classified or non-payday-aligned retries.
 */
const DEFAULT_RETRY_INTERVALS_MS = [
  0,                        // Attempt 1: immediate
  1 * 24 * 60 * 60 * 1000,  // Attempt 2: +1 day
  3 * 24 * 60 * 60 * 1000,  // Attempt 3: +3 days
  7 * 24 * 60 * 60 * 1000,  // Attempt 4: +7 days
  14 * 24 * 60 * 60 * 1000, // Attempt 5: +14 days
];

/**
 * Calculate the next retry date.
 *
 * For "insufficient_funds" (soft decline): align with payday (1st or 15th).
 * For other soft declines: use default exponential intervals.
 * For hard declines: return null (no retry).
 */
export function calculateNextRetryDate(
  attemptNumber: number,
  declineCode?: string
): Date | null {
  if (attemptNumber >= MAX_DUNNING_ATTEMPTS) {
    return null; // Max attempts reached
  }

  const classification = declineCode
    ? classifyDeclineCode(declineCode)
    : null;

  // Hard decline: no retry
  if (classification?.type === "hard") {
    return null;
  }

  // Payday-aligned retry for insufficient funds
  if (classification?.category === "insufficient_funds") {
    return calculateNextPayday();
  }

  // Default: use exponential backoff interval
  const intervalMs =
    DEFAULT_RETRY_INTERVALS_MS[attemptNumber] ??
    DEFAULT_RETRY_INTERVALS_MS[DEFAULT_RETRY_INTERVALS_MS.length - 1]!;
  return new Date(Date.now() + intervalMs);
}

/**
 * Calculate the next payday date (1st or 15th of the month).
 * Per feature_implementation_blueprint.md §3.3
 */
export function calculateNextPayday(): Date {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (currentDay < 15) {
    // Next payday is the 15th of this month
    return new Date(currentYear, currentMonth, 15, 9, 0, 0);
  } else {
    // Next payday is the 1st of next month
    return new Date(currentYear, currentMonth + 1, 1, 9, 0, 0);
  }
}

/**
 * Process a single dunning retry attempt.
 *
 * @param dunningAttemptId - The DunningAttempt record to process
 */
export async function processDunningRetry(
  dunningAttemptId: Types.ObjectId
): Promise<{ success: boolean; error?: string }> {
  const attempt = await DunningAttempt.findById(dunningAttemptId);
  if (!attempt) {
    return { success: false, error: "Dunning attempt not found" };
  }

  if (attempt.status !== "scheduled") {
    return { success: false, error: `Attempt status is ${attempt.status}, not scheduled` };
  }

  const subscription = await Subscription.findById(attempt.subscriptionId)
    .populate("planId")
    .populate("customerId");

  if (!subscription) {
    attempt.status = "skipped";
    attempt.failureReason = "Subscription not found";
    await attempt.save();
    return { success: false, error: "Subscription not found" };
  }

  // Skip if subscription is no longer in a retryable state
  if (!["past_due", "active"].includes(subscription.status)) {
    attempt.status = "skipped";
    attempt.failureReason = `Subscription status is ${subscription.status}`;
    await attempt.save();
    return { success: false, error: `Subscription is ${subscription.status}` };
  }

  if (!subscription.tokenKey && attempt.retryStrategy !== "manual") {
    attempt.status = "skipped";
    attempt.failureReason = "No payment token on file";
    await attempt.save();
    return { success: false, error: "No payment token" };
  }

  const plan = subscription.planId as any;
  const customer = subscription.customerId as any;

  const invoice = await Invoice.findById(attempt.invoiceId);
  if (!invoice) {
    attempt.status = "skipped";
    attempt.failureReason = "Invoice not found";
    await attempt.save();
    return { success: false, error: "Invoice not found" };
  }

  attempt.executedAt = new Date();

  try {
    // === MANUAL RENEWAL DUNNING ===
    if (attempt.retryStrategy === "manual") {
      // Send manual invoice reminder email
      await queueEmail("customer", "manual_invoice_reminder", {
        tenantId: subscription.tenantId,
        customerId: customer._id,
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
      });

      attempt.status = "failed";
      attempt.failureReason = "Awaiting manual payment";
      attempt.retryStrategy = "manual";

      // Calculate next retry
      const nextRetryDate = calculateNextRetryDate(
        attempt.attemptNumber,
        undefined
      );
      attempt.nextRetryAt = nextRetryDate || undefined;
      await attempt.save();

      if (!nextRetryDate || attempt.attemptNumber >= MAX_DUNNING_ATTEMPTS) {
        // Max attempts reached — mark subscription unpaid
        (subscription as any)._previousStatus = subscription.status;
        subscription.status = "unpaid";
        await subscription.save();

        await queueWebhook(subscription.tenantId, "subscription.unpaid", {
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          totalAttempts: attempt.attemptNumber,
          finalDeclineCode: "manual_timeout",
          finalDeclineCategory: "manual",
        });

        logger.error(
          {
            subscriptionId: subscription._id,
            attempts: attempt.attemptNumber,
          },
          "Manual dunning exhausted — subscription marked unpaid"
        );
      } else {
        // Schedule next retry
        await DunningAttempt.create({
          tenantId: subscription.tenantId,
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          attemptNumber: attempt.attemptNumber + 1,
          scheduledFor: nextRetryDate,
          status: "scheduled",
          nextRetryAt: nextRetryDate,
          retryStrategy: "manual",
        });

        subscription.dunningAttemptCount = attempt.attemptNumber;
        subscription.lastDunningAt = new Date();
        await subscription.save();

        logger.info(
          {
            subscriptionId: subscription._id,
            nextAttempt: attempt.attemptNumber + 1,
          },
          "Manual dunning reminder sent — next attempt scheduled"
        );
      }

      return { success: false, error: "Awaiting manual payment" };
    }

    // === AUTO RENEWAL DUNNING ===
    const orderReference = `retry_${invoice._id}_${attempt.attemptNumber}`;

    const chargeResult = await nombaService.chargeTokenizedCard({
      tokenKey: subscription.tokenKey!,
      orderReference,
      amount: plan.amount,
      currency: plan.currency as "NGN" | "CDF" | "USD" | undefined,
      customerEmail: customer.email,
      customerId: customer._id.toString(),
      callbackUrl: `${env.FRONTEND_URL}/billing/dunning?ref=${orderReference}`,
    });

    if (chargeResult.success) {
      // === DUNNING SUCCESS ===
      attempt.status = "succeeded";
      await attempt.save();

      // Update invoice
      invoice.status = "paid";
      invoice.paidAt = new Date();
      invoice.nombaTransactionId = orderReference;
      await invoice.save();

      // Reset subscription to active
      (subscription as any)._previousStatus = subscription.status;
      subscription.status = "active";
      subscription.dunningAttemptCount = 0;
      subscription.lastDunningAt = undefined;

      // Advance billing dates
      const now = new Date();
      const newPeriodStart = subscription.currentPeriodEnd || now;
      const newPeriodEnd = calculateNextBillingDate(
        newPeriodStart,
        plan.interval as PlanInterval
      );
      subscription.currentPeriodStart = newPeriodStart;
      subscription.currentPeriodEnd = newPeriodEnd;
      subscription.nextBillingDate = newPeriodEnd;
      await subscription.save();

      // Fire webhook: subscription.renewed
      await queueWebhook(subscription.tenantId, "subscription.renewed", {
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
        recoveredViaDunning: true,
        attemptNumber: attempt.attemptNumber,
      });

      logger.info(
        {
          subscriptionId: subscription._id,
          attemptNumber: attempt.attemptNumber,
        },
        "Dunning retry succeeded — subscription recovered"
      );

      return { success: true };
    } else {
      // === DUNNING FAILED ===
      // Nomba tokenized card endpoint doesn't return a granular decline code
      const declineCode: string | undefined = undefined;
      const classification = declineCode
        ? classifyDeclineCode(declineCode)
        : null;

      attempt.status = "failed";
      attempt.failureReason = chargeResult.message || "Payment declined";
      attempt.declineCode = declineCode;
      attempt.declineCategory = classification?.category;
      attempt.declineType = classification?.type;

      // Calculate next retry
      const nextRetryDate = calculateNextRetryDate(
        attempt.attemptNumber,
        declineCode
      );
      attempt.nextRetryAt = nextRetryDate || undefined;
      attempt.retryStrategy = classification?.retryStrategy || "default";
      await attempt.save();

      if (!nextRetryDate || attempt.attemptNumber >= MAX_DUNNING_ATTEMPTS) {
        // Max attempts reached or hard decline — mark subscription unpaid
        (subscription as any)._previousStatus = subscription.status;
        subscription.status = "unpaid";
        await subscription.save();

        await queueWebhook(subscription.tenantId, "subscription.unpaid", {
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          totalAttempts: attempt.attemptNumber,
          finalDeclineCode: declineCode,
          finalDeclineCategory: classification?.category,
        });

        logger.error(
          {
            subscriptionId: subscription._id,
            attempts: attempt.attemptNumber,
          },
          "Dunning exhausted — subscription marked unpaid"
        );
      } else {
        // Schedule next retry
        const nextAttempt = await DunningAttempt.create({
          tenantId: subscription.tenantId,
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          attemptNumber: attempt.attemptNumber + 1,
          scheduledFor: nextRetryDate,
          status: "scheduled",
          nextRetryAt: nextRetryDate,
          retryStrategy: classification?.retryStrategy || "default",
        });

        subscription.dunningAttemptCount = attempt.attemptNumber;
        subscription.lastDunningAt = new Date();
        await subscription.save();

        logger.info(
          {
            subscriptionId: subscription._id,
            nextAttempt: attempt.attemptNumber + 1,
            nextRetryAt: nextRetryDate.toISOString(),
            strategy: classification?.retryStrategy || "default",
          },
          "Dunning retry failed — next attempt scheduled"
        );
      }

      return {
        success: false,
        error: chargeResult.message || "Payment declined",
      };
    }
  } catch (error) {
    attempt.status = "failed";
    attempt.failureReason =
      error instanceof Error ? error.message : "Unknown error";
    await attempt.save();

    logger.error(
      {
        dunningAttemptId: attempt._id,
        error: attempt.failureReason,
      },
      "Dunning retry encountered an unexpected error"
    );

    return { success: false, error: attempt.failureReason };
  }
}
