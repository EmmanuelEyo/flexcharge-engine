import { Types } from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { Plan } from "../models/Plan.js";
import { Customer } from "../models/Customer.js";
import { DunningAttempt } from "../models/DunningAttempt.js";
import { nombaService } from "./nomba.service.js";
import { queueWebhook } from "./webhook.service.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import { ledgerService } from "./ledger.service.js";
import { logger } from "../utils/logger.js";
import { INTERVAL_DAYS } from "../types/subscription.types.js";
import type { PlanInterval } from "../types/subscription.types.js";
import { env } from "../config/environment.js";

/**
 * Billing Service — Core renewal scanning and charge processing.
 *
 * Handles:
 * 1. Finding subscriptions due for renewal
 * 2. Charging tokenized cards via Nomba
 * 3. Advancing billing periods on success
 * 4. Transitioning to past_due and initiating dunning on failure
 * 5. Processing cancel-at-period-end subscriptions
 *
 * Per overall_implementation_plan.md §6.2 (Daily Billing Scan)
 * Per AGENTS.md §3: Financial values in KOBO (integers only)
 */

/**
 * Calculate the next billing date by advancing from the current period end
 * by the plan's interval.
 */
export function calculateNextBillingDate(
  currentPeriodEnd: Date,
  interval: PlanInterval,
  intervalDays?: number
): Date {
  const days = interval === "custom" && intervalDays ? intervalDays : INTERVAL_DAYS[interval as Exclude<PlanInterval, "custom">];
  const next = new Date(currentPeriodEnd);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Find all active subscriptions that are due for renewal.
 * Used by the dailyBillingScan Agenda job.
 */
export async function findDueSubscriptions(): Promise<typeof Subscription extends { find: (...args: any[]) => infer R } ? Awaited<R> : never> {
  const now = new Date();

  return Subscription.find({
    status: "active",
    nextBillingDate: { $lte: now },
    cancelAtPeriodEnd: { $ne: true },
  })
    .populate("planId")
    .populate("customerId");
}

/**
 * Find subscriptions that should be canceled at period end.
 */
export async function findCancelAtPeriodEndSubscriptions() {
  const now = new Date();

  return Subscription.find({
    status: "active",
    cancelAtPeriodEnd: true,
    currentPeriodEnd: { $lte: now },
  });
}

/**
 * Process a single subscription renewal.
 *
 * Per overall_implementation_plan.md §6.2:
 * 1. Generate idempotencyKey = "bill_subId_periodEnd"
 * 2. Create Invoice (status: pending)
 * 3. Call nomba.chargeTokenizedCard(tokenKey, amount)
 * 4. On success: Update Invoice → paid, advance billing dates
 * 5. On failure: Update Invoice → failed, transition to past_due, create DunningAttempt
 */
export async function processRenewal(subscriptionId: Types.ObjectId): Promise<{
  success: boolean;
  invoiceId?: Types.ObjectId;
  error?: string;
}> {
  const subscription = await Subscription.findById(subscriptionId)
    .populate("planId")
    .populate("customerId");

  if (!subscription) {
    return { success: false, error: "Subscription not found" };
  }

  if (subscription.status !== "active") {
    return { success: false, error: `Subscription is ${subscription.status}, not active` };
  }

  const plan = subscription.planId as any;
  const customer = subscription.customerId as any;

  if (!plan || !customer) {
    return { success: false, error: "Plan or customer not found" };
  }

  // Generate idempotency key to prevent double charges
  const periodEndStr = subscription.currentPeriodEnd
    ? subscription.currentPeriodEnd.toISOString().split("T")[0]
    : Date.now().toString();
  const idempotencyKey = `bill_${subscription._id}_${periodEndStr}`;

  // Check if we already billed for this period
  const existingInvoice = await Invoice.findOne({ idempotencyKey });
  if (existingInvoice) {
    logger.warn(
      { subscriptionId, idempotencyKey },
      "Duplicate billing attempt detected — skipping"
    );
    return { success: false, error: "Already billed for this period" };
  }

  // Create pending invoice
  const orderReference = `inv_${subscription._id}_${Date.now()}`;
  const invoice = await Invoice.create({
    tenantId: subscription.tenantId,
    subscriptionId: subscription._id,
    customerId: customer._id,
    amount: plan.amount,
    currency: plan.currency || "NGN",
    status: "pending",
    nombaOrderReference: orderReference,
    description: `${plan.name} — Renewal`,
    isRenewal: true,
    idempotencyKey,
  });

  // === MANUAL RENEWAL FLOW ===
  if (subscription.renewalMode === "manual" || !subscription.tokenKey) {
    return await triggerManualRenewal(subscription, invoice, customer, plan, orderReference);
  }

  // === AUTO RENEWAL FLOW ===
  try {
    let chargeSuccess = false;
    let chargeMessage = "";

    if (subscription.automaticMethod === "direct_debit") {
      // === DIRECT DEBIT CHARGE ===
      // Look up the customer's default direct debit mandate
      const defaultMandate = customer.paymentMethods?.find(
        (pm: any) => pm.methodType === "direct_debit" && pm.isDefault && pm.mandateStatus === "ACTIVE"
      );

      if (!defaultMandate?.mandateId) {
        // No usable mandate — fall back to manual billing for this cycle
        logger.warn(
          { subscriptionId: subscription._id },
          "No active default direct debit mandate found — falling back to manual renewal"
        );
        return await handleChargeFailed(
          subscription,
          invoice,
          undefined,
          "No active direct debit mandate on file"
        );
      }

      const debitResult = await nombaService.debitMandate(
        defaultMandate.mandateId,
        plan.amount
      );
      chargeSuccess = debitResult.success;
      chargeMessage = debitResult.message;
    } else {
      // === CARD CHARGE (existing flow) ===
      if (!subscription.tokenKey) {
        return await handleChargeFailed(
          subscription,
          invoice,
          undefined,
          "No card token on file for automatic card renewal"
        );
      }

      const cardResult = await nombaService.chargeTokenizedCard({
        tokenKey: subscription.tokenKey,
        orderReference,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        customerEmail: customer.email,
        customerId: customer._id.toString(),
        callbackUrl: `${env.FRONTEND_URL}/billing/complete?ref=${orderReference}`,
      });
      chargeSuccess = cardResult.success;
      chargeMessage = cardResult.message;

      // === OTP REQUIRED FALLBACK ===
      if (!chargeSuccess && cardResult.requiresOTP) {
        logger.warn(
          { subscriptionId: subscription._id },
          "Bank requires OTP. Converting subscription to manual renewal."
        );
        subscription.renewalMode = "manual";
        await subscription.save();
        
        return await triggerManualRenewal(subscription, invoice, customer, plan, orderReference);
      }
    }

    if (chargeSuccess) {
      // === PAYMENT SUCCESS ===
      invoice.status = "paid";
      invoice.paidAt = new Date();
      invoice.nombaTransactionId = orderReference; // Use orderReference as our internal ref
      await invoice.save();

      // Credit tenant ledger
      await ledgerService.creditTenant(
        subscription.tenantId,
        plan.amount,
        invoice._id.toString()
      );

      // Advance billing dates
      const now = new Date();
      const newPeriodStart = subscription.currentPeriodEnd || now;
      const newPeriodEnd = calculateNextBillingDate(
        newPeriodStart,
        plan.interval,
        plan.intervalDays
      );

      subscription.currentPeriodStart = newPeriodStart;
      subscription.currentPeriodEnd = newPeriodEnd;
      subscription.nextBillingDate = newPeriodEnd;
      subscription.dunningAttemptCount = 0;
      subscription.lastDunningAt = undefined;
      await subscription.save();

      // Fire webhook: subscription.renewed
      await queueWebhook(subscription.tenantId, "subscription.renewed", {
        subscriptionId: subscription._id,
        customerId: customer._id,
        planId: plan._id,
        amount: plan.amount,
        currency: plan.currency,
        currentPeriodStart: newPeriodStart.toISOString(),
        currentPeriodEnd: newPeriodEnd.toISOString(),
        invoiceId: invoice._id,
      });

      logger.info(
        {
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          nextBilling: newPeriodEnd.toISOString(),
        },
        "Subscription renewed successfully"
      );

      // Queue receipt email to customer
      await queueEmail("customer", "receipt", {
        tenantId: subscription.tenantId,
        customerId: customer._id,
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
      });

      return { success: true, invoiceId: invoice._id };
    } else {
      // === PAYMENT FAILED ===
      return await handleChargeFailed(
        subscription,
        invoice,
        undefined,
        chargeMessage || "Payment charge declined"
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown payment error";

    return await handleChargeFailed(
      subscription,
      invoice,
      undefined,
      errorMessage
    );
  }
}

/**
 * Handle a failed charge attempt.
 * Transitions subscription to past_due and creates a DunningAttempt.
 */
async function handleChargeFailed(
  subscription: any,
  invoice: any,
  declineCode?: string,
  failureReason?: string
): Promise<{ success: false; invoiceId: Types.ObjectId; error: string }> {
  // Update invoice
  invoice.status = "failed";
  invoice.failureReason = failureReason;
  await invoice.save();

  // Transition subscription to past_due (if currently active)
  if (subscription.status === "active") {
    (subscription as any)._previousStatus = subscription.status;
    subscription.status = "past_due";
  }
  subscription.dunningAttemptCount += 1;
  subscription.lastDunningAt = new Date();
  await subscription.save();

  // Create DunningAttempt record
  const retryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h default
  await DunningAttempt.create({
    tenantId: subscription.tenantId,
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    attemptNumber: subscription.dunningAttemptCount,
    scheduledFor: retryDate,
    status: "scheduled",
    failureReason,
    nextRetryAt: retryDate,
    declineCode,
  });

  // Fire webhook: subscription.payment_failed
  await queueWebhook(subscription.tenantId, "subscription.payment_failed", {
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    amount: invoice.amount,
    currency: invoice.currency,
    failureReason,
    declineCode,
    attemptNumber: subscription.dunningAttemptCount,
  });

  logger.warn(
    {
      subscriptionId: subscription._id,
      invoiceId: invoice._id,
      declineCode,
      failureReason,
      attemptNumber: subscription.dunningAttemptCount,
    },
    "Subscription charge failed — entering dunning"
  );

  // Queue dunning email to customer + payment_failed to tenant
  const emailCtx = {
    tenantId: subscription.tenantId,
    customerId: (subscription.customerId as any)?._id || subscription.customerId,
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    failureReason: failureReason || "Payment declined",
    attemptNumber: subscription.dunningAttemptCount,
  };
  await queueEmail("customer", "dunning", emailCtx);
  await queueEmail("tenant", "payment_failed", emailCtx);

  return {
    success: false,
    invoiceId: invoice._id,
    error: failureReason || "Payment failed",
  };
}

/**
 * Process subscriptions marked for cancel-at-period-end.
 * Called by the daily billing scan.
 */
export async function processCancelAtPeriodEnd(): Promise<number> {
  const subscriptions = await findCancelAtPeriodEndSubscriptions();
  let canceledCount = 0;

  for (const subscription of subscriptions) {
    (subscription as any)._previousStatus = subscription.status;
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    await subscription.save();

    // Fire webhook: subscription.canceled
    await queueWebhook(subscription.tenantId, "subscription.canceled", {
      subscriptionId: subscription._id,
      reason: subscription.cancellationReason || "Period ended",
    });

    canceledCount++;

    // Queue cancel emails to both customer and tenant
    await queueEmail("customer", "cancel", {
      tenantId: subscription.tenantId,
      customerId: subscription.customerId as any,
      subscriptionId: subscription._id,
      cancellationReason: subscription.cancellationReason || "Period ended",
    });
    await queueEmail("tenant", "cancel", {
      tenantId: subscription.tenantId,
      customerId: subscription.customerId as any,
      subscriptionId: subscription._id,
      cancellationReason: subscription.cancellationReason || "Period ended",
    });

    logger.info(
      { subscriptionId: subscription._id },
      "Subscription canceled at period end"
    );
  }

  return canceledCount;
}

/**
 * Scan for active manual subscriptions that are due for renewal in the next 3 days,
 * generate a pending invoice and a Nomba checkout link, and email them a reminder.
 */
export async function sendUpcomingRenewalReminders(daysAhead: number = 3): Promise<number> {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Find active manual subscriptions due within next N days
  const subscriptions = await Subscription.find({
    status: "active",
    $or: [
      { renewalMode: "manual" },
      { tokenKey: { $in: [null, undefined, ""] } }
    ],
    nextBillingDate: { $lte: reminderThreshold },
    cancelAtPeriodEnd: { $ne: true },
  }).populate("planId").populate("customerId");

  let reminderCount = 0;

  for (const subscription of subscriptions) {
    const plan = subscription.planId as any;
    const customer = subscription.customerId as any;

    if (!plan || !customer) {
      continue;
    }

    const periodEndStr = subscription.currentPeriodEnd
      ? subscription.currentPeriodEnd.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const idempotencyKey = `bill_${subscription._id}_${periodEndStr}`;

    // Check if an invoice was already generated for this cycle
    const existingInvoice = await Invoice.findOne({ idempotencyKey });
    if (existingInvoice) {
      continue;
    }

    const orderReference = `inv_${subscription._id}_${Date.now()}`;

    // Create a pending invoice ahead of time
    const invoice = await Invoice.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription._id,
      customerId: customer._id,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      status: "pending",
      nombaOrderReference: orderReference,
      description: `${plan.name} — Renewal (Upcoming)`,
      isRenewal: true,
      idempotencyKey,
    });

    if (nombaService.isConfigured()) {
      try {
        const checkoutResult = await nombaService.createCheckoutOrder({
          orderReference,
          amount: plan.amount,
          currency: plan.currency || "NGN",
          customerEmail: customer.email,
          callbackUrl: `${env.FRONTEND_URL || "http://localhost:3000"}/success?orderRef=${orderReference}`,
          tokenizeCard: false,
        });

        invoice.checkoutLink = checkoutResult.checkoutLink;
        await invoice.save();

        // Send upcoming manual invoice notification
        await queueEmail("customer", "manual_invoice", {
          tenantId: subscription.tenantId,
          customerId: customer._id,
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
        });

        logger.info(
          { subscriptionId: subscription._id, invoiceId: invoice._id },
          "Sent upcoming renewal reminder for manual subscription"
        );
        reminderCount++;
      } catch (error) {
        logger.error(
          {
            subscriptionId: subscription._id,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Failed to create Nomba checkout order for upcoming renewal"
        );
        // Delete the created invoice so we can retry on next scan
        await Invoice.deleteOne({ _id: invoice._id });
      }
    } else {
      logger.warn(
        { subscriptionId: subscription._id },
        "Nomba service not configured — skipping checkout link creation for upcoming manual renewal"
      );
      reminderCount++;
    }
  }

  return reminderCount;
}
/**
 * Triggers a manual renewal flow by generating a checkout link,
 * placing the subscription into past_due (if active), creating a 
 * manual dunning record, and queueing a manual invoice email.
 */
async function triggerManualRenewal(
  subscription: any,
  invoice: any,
  customer: any,
  plan: any,
  orderReference: string
): Promise<{ success: boolean; invoiceId?: Types.ObjectId; error?: string }> {
  try {
    const checkoutResult = await nombaService.createCheckoutOrder({
      orderReference,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      customerEmail: customer.email,
      callbackUrl: `${env.FRONTEND_URL}/success?orderRef=${orderReference}`,
      tokenizeCard: false,
    });

    invoice.checkoutLink = checkoutResult.checkoutLink;
    await invoice.save();

    // Transition subscription to past_due
    if (subscription.status === "active") {
      (subscription as any)._previousStatus = subscription.status;
      subscription.status = "past_due";
    }
    subscription.dunningAttemptCount = 1;
    subscription.lastDunningAt = new Date();
    await subscription.save();

    // Create DunningAttempt record for manual reminders
    const retryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h default
    await DunningAttempt.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription._id,
      invoiceId: invoice._id,
      attemptNumber: 1,
      scheduledFor: retryDate,
      status: "scheduled",
      failureReason: "Awaiting manual payment",
      nextRetryAt: retryDate,
      retryStrategy: "manual",
    });

    // Send manual invoice email
    await queueEmail("customer", "manual_invoice", {
      tenantId: subscription.tenantId,
      customerId: customer._id,
      subscriptionId: subscription._id,
      invoiceId: invoice._id,
    });

    logger.info(
      { subscriptionId: subscription._id, invoiceId: invoice._id },
      "Created manual renewal invoice and entered dunning"
    );

    return { success: true, invoiceId: invoice._id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown manual checkout error";
    
    // Fall back to handleChargeFailed so standard logic runs
    return await handleChargeFailed(
      subscription,
      invoice,
      undefined,
      errorMessage
    );
  }
}
