import { getAgenda } from "../config/agenda.js";
import { SEND_EMAIL_JOB_NAME } from "../jobs/sendEmail.js";
import { isEmailConfigured } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import { Types } from "mongoose";

/**
 * Email Dispatcher — convenience wrapper around Agenda to queue email jobs.
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
}

type CustomerEmailType = "welcome" | "receipt" | "dunning" | "cancel" | "manual_invoice" | "manual_invoice_reminder" | "refund_processed";
type TenantEmailType = "new_subscriber" | "payment_failed" | "cancel" | "withdrawal_successful" | "withdrawal_failed" | "refund_deducted";

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
    const agenda = getAgenda();
    await agenda.now(SEND_EMAIL_JOB_NAME, {
      recipientType,
      type,
      tenantId: context.tenantId.toString(),
      customerId: context.customerId?.toString(),
      subscriptionId: context.subscriptionId?.toString(),
      invoiceId: context.invoiceId?.toString(),
      failureReason: context.failureReason,
      attemptNumber: context.attemptNumber,
      cancellationReason: context.cancellationReason,
    });

    logger.debug(
      { recipientType, type },
      "Email job queued"
    );
  } catch (err) {
    // Never let email failures crash the main flow
    logger.error(
      { recipientType, type, err: err instanceof Error ? err.message : "Unknown" },
      "Failed to queue email job"
    );
  }
}
