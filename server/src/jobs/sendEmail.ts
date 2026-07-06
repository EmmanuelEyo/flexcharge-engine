
import { Types } from "mongoose";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { sendEmail, isEmailConfigured } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/environment.js";

// Customer templates
import { WelcomeEmail } from "../emails/customer/WelcomeEmail.js";
import { ReceiptEmail } from "../emails/customer/ReceiptEmail.js";
import { DunningEmail } from "../emails/customer/DunningEmail.js";
import { CancelEmail } from "../emails/customer/CancelEmail.js";
import { ManualInvoiceEmail } from "../emails/customer/ManualInvoiceEmail.js";
import { ManualInvoiceReminderEmail } from "../emails/customer/ManualInvoiceReminderEmail.js";
import { RefundProcessedEmail } from "../emails/customer/RefundProcessedEmail.js";
import { PortalLinkEmail } from "../emails/customer/PortalLinkEmail.js";
import { PlanChangedEmail } from "../emails/customer/PlanChangedEmail.js";
import { WalletToppedUpEmail } from "../emails/customer/WalletToppedUpEmail.js";
import { SubscriptionPausedEmail } from "../emails/customer/SubscriptionPausedEmail.js";
import { SubscriptionResumedEmail } from "../emails/customer/SubscriptionResumedEmail.js";

// Tenant templates
import { TenantNewSubscriberEmail } from "../emails/tenant/TenantNewSubscriberEmail.js";
import { TenantPaymentFailedEmail } from "../emails/tenant/TenantPaymentFailedEmail.js";
import { TenantCancelEmail } from "../emails/tenant/TenantCancelEmail.js";
import { WithdrawalSuccessfulEmail } from "../emails/tenant/WithdrawalSuccessfulEmail.js";
import { WithdrawalFailedEmail } from "../emails/tenant/WithdrawalFailedEmail.js";
import { RefundDeductedEmail } from "../emails/tenant/RefundDeductedEmail.js";
import { TenantWelcomeEmail } from "../emails/tenant/TenantWelcomeEmail.js";
import { TenantBankAccountChangedEmail } from "../emails/tenant/TenantBankAccountChangedEmail.js";
import { TenantSubscriptionPausedEmail } from "../emails/tenant/TenantSubscriptionPausedEmail.js";
import { TenantSubscriptionResumedEmail } from "../emails/tenant/TenantSubscriptionResumedEmail.js";

import React from "react";

export const SEND_EMAIL_JOB_NAME = "send-email";

/**
 * Email Job Payload — every email dispatch gets one of these.
 */
export interface EmailJobPayload {
  /** Who receives the email: the customer or the tenant/developer. */
  recipientType: "customer" | "tenant";
  /** The type of email to send. */
  type: "welcome" | "receipt" | "dunning" | "cancel" | "new_subscriber" | "payment_failed" | "manual_invoice" | "manual_invoice_reminder" | "withdrawal_successful" | "withdrawal_failed" | "refund_deducted" | "refund_processed" | "portal_link" | "plan_changed" | "wallet_topped_up" | "subscription_paused" | "subscription_resumed" | "bank_account_changed";
  /** Database IDs used to look up the records at dispatch time. */
  tenantId: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /** Extra context that some templates need. */
  failureReason?: string;
  attemptNumber?: number;
  cancellationReason?: string;
  portalUrl?: string;
  newPlanId?: string;
  oldPlanId?: string;
  topupAmount?: number;
  balanceAfter?: number;
  bankName?: string;
  accountNumber?: string;
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
 * Process the email payload natively.
 */
export async function processEmailPayload(data: EmailJobPayload): Promise<void> {

    if (!isEmailConfigured()) {
      logger.warn({ type: data.type, recipientType: data.recipientType }, "Email skipped — not configured");
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
              hasPaymentToken: !!subscription?.tokenKey,
              portalUrl: data.portalUrl || `${env.FRONTEND_URL}/portal`,
            });
            break;

          case "portal_link":
            if (!data.portalUrl) {
              logger.warn(data, "Email job: portal_link requires portalUrl — skipping");
              return;
            }
            subject = `Your Customer Portal Access Link for ${tenant.name}`;
            element = React.createElement(PortalLinkEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              portalUrl: data.portalUrl,
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
              portalLink: `${env.FRONTEND_URL}/portal`,
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
              portalLink: `${env.FRONTEND_URL}/portal`,
            });
            break;

          case "refund_processed":
            subject = `Refund processed for Invoice ${invoice?._id?.toString() || "—"}`;
            element = React.createElement(RefundProcessedEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              invoiceId: invoice?._id?.toString() || "—",
            });
            break;

          case "plan_changed":
            const [oldPlan, newPlan] = await Promise.all([
              Plan.findById(data.oldPlanId),
              Plan.findById(data.newPlanId),
            ]);
            subject = `Subscription plan updated — ${tenant.name}`;
            element = React.createElement(PlanChangedEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              oldPlanName: oldPlan?.name || "Previous Plan",
              newPlanName: newPlan?.name || "New Plan",
              newAmount: formatKobo(newPlan?.amount || 0, newPlan?.currency),
            });
            break;

          case "wallet_topped_up":
            subject = `Wallet top-up successful — ${tenant.name}`;
            const customerWallet = data.customerId 
              ? await (await import("../models/Wallet.js")).Wallet.findOne({ customerId: data.customerId, tenantId: data.tenantId })
              : null;
            element = React.createElement(WalletToppedUpEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              topupAmount: formatKobo(data.topupAmount || 0, "NGN"),
              balanceAfter: formatKobo(customerWallet?.balance || data.balanceAfter || 0, "NGN"),
            });
            break;

          case "subscription_paused":
            subject = `Your subscription is paused — ${tenant.name}`;
            element = React.createElement(SubscriptionPausedEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              planName: plan?.name || "Subscription",
            });
            break;

          case "subscription_resumed":
            subject = `Your subscription is active — ${tenant.name}`;
            element = React.createElement(SubscriptionResumedEmail, {
              customerName: customer?.name || "there",
              tenantName: tenant.name,
              planName: plan?.name || "Subscription",
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

          case "withdrawal_successful":
            subject = `Withdrawal successful: ${data.failureReason} has been processed`;
            element = React.createElement(WithdrawalSuccessfulEmail, {
              tenantName: tenant.name,
              amount: formatKobo(parseInt(data.failureReason || "0"), "NGN"), // Using failureReason as amount for now
            });
            break;

          case "withdrawal_failed":
            subject = `⚠️ Withdrawal failed`;
            element = React.createElement(WithdrawalFailedEmail, {
              tenantName: tenant.name,
              reason: data.failureReason || "Unknown error",
            });
            break;

          case "refund_deducted":
            subject = `Refund processed: Invoice ${invoice?._id?.toString() || "—"}`;
            element = React.createElement(RefundDeductedEmail, {
              tenantName: tenant.name,
              invoiceId: invoice?._id?.toString() || "—",
            });
            break;

          case "welcome":
            subject = `Welcome to FlexCharge, ${tenant.name}! 🎉`;
            element = React.createElement(TenantWelcomeEmail, {
              tenantName: tenant.name,
            });
            break;

          case "bank_account_changed":
            subject = `Security Alert: Settlement bank account changed`;
            element = React.createElement(TenantBankAccountChangedEmail, {
              tenantName: tenant.name,
              bankName: data.bankName || "Unknown Bank",
              accountNumber: data.accountNumber || "—",
            });
            break;

          case "subscription_paused":
            subject = `Customer subscription paused — ${tenant.name}`;
            element = React.createElement(TenantSubscriptionPausedEmail, {
              tenantName: tenant.name,
              customerName: customer?.name || "Unknown",
              customerEmail: customer?.email || "—",
              planName: plan?.name || "Subscription",
            });
            break;

          case "subscription_resumed":
            subject = `Customer subscription resumed — ${tenant.name}`;
            element = React.createElement(TenantSubscriptionResumedEmail, {
              tenantName: tenant.name,
              customerName: customer?.name || "Unknown",
              customerEmail: customer?.email || "—",
              planName: plan?.name || "Subscription",
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
        "Email dispatched via outbox worker"
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
      throw err; // Let the outbox worker retry the job
    }
}
