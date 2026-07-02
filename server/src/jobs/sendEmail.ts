import { Agenda, Job } from "agenda";
import { Types } from "mongoose";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { sendEmail, isEmailConfigured } from "../services/email.service.js";
import { logger } from "../utils/logger.js";

// Customer templates
import { WelcomeEmail } from "../emails/customer/WelcomeEmail.js";
import { ReceiptEmail } from "../emails/customer/ReceiptEmail.js";
import { DunningEmail } from "../emails/customer/DunningEmail.js";
import { CancelEmail } from "../emails/customer/CancelEmail.js";
import { ManualInvoiceEmail } from "../emails/customer/ManualInvoiceEmail.js";
import { ManualInvoiceReminderEmail } from "../emails/customer/ManualInvoiceReminderEmail.js";

// Tenant templates
import { TenantNewSubscriberEmail } from "../emails/tenant/TenantNewSubscriberEmail.js";
import { TenantPaymentFailedEmail } from "../emails/tenant/TenantPaymentFailedEmail.js";
import { TenantCancelEmail } from "../emails/tenant/TenantCancelEmail.js";

import React from "react";

export const SEND_EMAIL_JOB_NAME = "send-email";

/**
 * Email Job Payload — every email dispatch gets one of these.
 */
interface EmailJobPayload {
  /** Who receives the email: the customer or the tenant/developer. */
  recipientType: "customer" | "tenant";
  /** The type of email to send. */
  type: "welcome" | "receipt" | "dunning" | "cancel" | "new_subscriber" | "payment_failed" | "manual_invoice" | "manual_invoice_reminder";
  /** Database IDs used to look up the records at dispatch time. */
  tenantId: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /** Extra context that some templates need. */
  failureReason?: string;
  attemptNumber?: number;
  cancellationReason?: string;
}

/**
 * Helper: format KOBO amount to a human-readable currency string.
 */
function formatKobo(kobo: number, currency = "NGN"): string {
  const value = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Helper: format a Date as "Jul 02, 2026".
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Define the send-email Agenda job.
 */
export function defineSendEmailJob(agenda: Agenda): void {
  agenda.define<EmailJobPayload>(SEND_EMAIL_JOB_NAME, async (job: Job<EmailJobPayload>) => {
    const data = job.attrs.data!;

    if (!isEmailConfigured()) {
      logger.debug({ type: data.type, recipientType: data.recipientType }, "Email skipped — not configured");
      return;
    }

    try {
      // Look up the Tenant (always needed)
      const tenant = await Tenant.findById(data.tenantId);
      if (!tenant) {
        logger.warn({ tenantId: data.tenantId }, "Email job: tenant not found — skipping");
        return;
      }

      // Look up Customer if provided
      const customer = data.customerId
        ? await Customer.findById(data.customerId)
        : null;

      // Look up Subscription + Plan if provided
      const subscription = data.subscriptionId
        ? await Subscription.findById(data.subscriptionId).populate("planId")
        : null;

      const plan = subscription
        ? (subscription.planId as any)
        : null;

      // Look up Invoice if provided
      const invoice = data.invoiceId
        ? await Invoice.findById(data.invoiceId)
        : null;

      // Determine recipient address
      const recipientEmail =
        data.recipientType === "tenant"
          ? tenant.email
          : customer?.email;

      if (!recipientEmail) {
        logger.warn(data, "Email job: no recipient email — skipping");
        return;
      }

      // Build the email based on type + recipientType
      let subject: string;
      let element: React.ReactElement;

      if (data.recipientType === "customer") {
        switch (data.type) {
          case "welcome":
            subject = `Welcome to ${tenant.name} — Your subscription is active!`;
            element = React.createElement(WelcomeEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              amount: formatKobo(plan?.amount || 0, plan?.currency),
              interval: plan?.interval || "month",
              tenantName: tenant.name,
            });
            break;

          case "receipt":
            subject = `Payment receipt from ${tenant.name}`;
            element = React.createElement(ReceiptEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              amount: formatKobo(invoice?.amount || plan?.amount || 0, plan?.currency),
              currency: plan?.currency || "NGN",
              periodStart: subscription?.currentPeriodStart
                ? formatDate(subscription.currentPeriodStart)
                : "—",
              periodEnd: subscription?.currentPeriodEnd
                ? formatDate(subscription.currentPeriodEnd)
                : "—",
              tenantName: tenant.name,
              invoiceId: invoice?._id?.toString() || "—",
            });
            break;

          case "dunning":
            subject = `⚠️ Payment failed — action required (${tenant.name})`;
            element = React.createElement(DunningEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              amount: formatKobo(plan?.amount || 0, plan?.currency),
              tenantName: tenant.name,
              failureReason: data.failureReason || "Payment declined",
              attemptNumber: data.attemptNumber || 1,
            });
            break;

          case "cancel":
            subject = `Your ${plan?.name || "subscription"} with ${tenant.name} has been canceled`;
            element = React.createElement(CancelEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              tenantName: tenant.name,
              reason: data.cancellationReason,
            });
            break;

          case "manual_invoice":
            subject = `Your invoice from ${tenant.name} is ready`;
            element = React.createElement(ManualInvoiceEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              amount: formatKobo(invoice?.amount || plan?.amount || 0, plan?.currency),
              tenantName: tenant.name,
              checkoutLink: invoice?.checkoutLink || "",
            });
            break;

          case "manual_invoice_reminder":
            subject = `Reminder: Pending invoice from ${tenant.name}`;
            element = React.createElement(ManualInvoiceReminderEmail, {
              customerName: customer?.name || "there",
              planName: plan?.name || "Subscription",
              amount: formatKobo(invoice?.amount || plan?.amount || 0, plan?.currency),
              tenantName: tenant.name,
              checkoutLink: invoice?.checkoutLink || "",
            });
            break;

          default:
            logger.warn({ type: data.type }, "Unknown customer email type");
            return;
        }
      } else {
        // recipientType === "tenant"
        switch (data.type) {
          case "new_subscriber":
            subject = `🎉 New subscriber: ${customer?.name || "A customer"} signed up for ${plan?.name || "a plan"}`;
            element = React.createElement(TenantNewSubscriberEmail, {
              tenantName: tenant.name,
              customerName: customer?.name || "Unknown",
              customerEmail: customer?.email || "—",
              planName: plan?.name || "Subscription",
              amount: formatKobo(plan?.amount || 0, plan?.currency),
              interval: plan?.interval || "month",
            });
            break;

          case "payment_failed":
            subject = `⚠️ Payment failed for ${customer?.name || "a customer"}`;
            element = React.createElement(TenantPaymentFailedEmail, {
              tenantName: tenant.name,
              customerName: customer?.name || "Unknown",
              customerEmail: customer?.email || "—",
              planName: plan?.name || "Subscription",
              amount: formatKobo(plan?.amount || 0, plan?.currency),
              failureReason: data.failureReason || "Payment declined",
              attemptNumber: data.attemptNumber || 1,
            });
            break;

          case "cancel":
            subject = `❌ ${customer?.name || "A customer"} canceled their ${plan?.name || "subscription"}`;
            element = React.createElement(TenantCancelEmail, {
              tenantName: tenant.name,
              customerName: customer?.name || "Unknown",
              customerEmail: customer?.email || "—",
              planName: plan?.name || "Subscription",
              reason: data.cancellationReason,
            });
            break;

          default:
            logger.warn({ type: data.type }, "Unknown tenant email type");
            return;
        }
      }

      await sendEmail(recipientEmail, subject, element);

      logger.info(
        { recipientType: data.recipientType, type: data.type, to: recipientEmail },
        "Email dispatched via Agenda job"
      );
    } catch (err) {
      logger.error(
        {
          type: data.type,
          recipientType: data.recipientType,
          err: err instanceof Error ? err.message : "Unknown",
        },
        "Email job failed"
      );
      throw err; // Let Agenda retry the job
    }
  });
}
