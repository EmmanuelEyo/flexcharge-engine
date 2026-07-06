import { isEmailConfigured } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import { Types } from "mongoose";
import { EmailOutbox } from "../models/EmailOutbox.js";

/**
 * Email Dispatcher — convenience wrapper around EmailOutbox to queue email jobs natively.
 *
 * Usage:
 *   await queueEmail("customer", "welcome", { tenantId, customerId, subscriptionId });
 *   await queueEmail("tenant",   "new_subscriber", { tenantId, customerId, subscriptionId });
 */

interface QueueEmailContext {
  tenantId: Types.ObjectId | string;
  customerId?: Types.ObjectId | string;
  subscriptionId?: Types.ObjectId | string;
  invoiceId?: Types.ObjectId | string;
  failureReason?: string;
  attemptNumber?: number;
  cancellationReason?: string;
  portalUrl?: string;
  cardLast4?: string;
  // New context variables
  newPlanId?: Types.ObjectId | string;
  oldPlanId?: Types.ObjectId | string;
  topupAmount?: number;
  balanceAfter?: number;
  bankName?: string;
  accountNumber?: string;
}

type CustomerEmailType = "welcome" | "receipt" | "dunning" | "cancel" | "manual_invoice" | "manual_invoice_reminder" | "refund_processed" | "portal_link" | "card_expiring" | "plan_changed" | "wallet_topped_up" | "subscription_paused" | "subscription_resumed";
type TenantEmailType = "new_subscriber" | "payment_failed" | "cancel" | "withdrawal_successful" | "withdrawal_failed" | "refund_deducted" | "welcome" | "bank_account_changed" | "subscription_paused" | "subscription_resumed";

export async function queueEmail(
  recipientType: "customer",
  type: CustomerEmailType,
  context: QueueEmailContext
): Promise<void>;

export async function queueEmail(
  recipientType: "tenant",
  type: TenantEmailType,
  context: QueueEmailContext
): Promise<void>;

export async function queueEmail(
  recipientType: "customer" | "tenant",
  type: string,
  context: QueueEmailContext
): Promise<void> {
  if (!isEmailConfigured()) {
    return; // Silently skip — no API key configured
  }

  try {
    await EmailOutbox.create({
      recipientType,
      type,
      tenantId: context.tenantId,
      customerId: context.customerId,
      subscriptionId: context.subscriptionId,
      invoiceId: context.invoiceId,
      failureReason: context.failureReason,
      attemptNumber: context.attemptNumber,
      cancellationReason: context.cancellationReason,
      portalUrl: context.portalUrl,
      // Pass extra context keys inside any meta fields or leverage general attributes
      // To support new properties on mongoose schema:
      ...(context.newPlanId ? { newPlanId: context.newPlanId } : {}),
      ...(context.oldPlanId ? { oldPlanId: context.oldPlanId } : {}),
      ...(context.topupAmount ? { topupAmount: context.topupAmount } : {}),
      ...(context.balanceAfter ? { balanceAfter: context.balanceAfter } : {}),
      ...(context.bankName ? { bankName: context.bankName } : {}),
      ...(context.accountNumber ? { accountNumber: context.accountNumber } : {}),
      status: "pending",
    });

    logger.info(
      { recipientType, type },
      "Email job queued in outbox"
    );
  } catch (err) {
    // Never let email failures crash the main flow
    logger.error(
      { recipientType, type, err: err instanceof Error ? err.message : "Unknown" },
      "Failed to queue email job in outbox"
    );
  }
}
