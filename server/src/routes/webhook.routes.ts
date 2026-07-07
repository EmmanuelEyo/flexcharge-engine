import { Router } from "express";
import express from "express";
import { Subscription } from "../models/Subscription.js";
import { Customer } from "../models/Customer.js";
import { Invoice } from "../models/Invoice.js";
import { WebhookReceipt } from "../models/WebhookReceipt.js";
import { nombaService } from "../services/nomba.service.js";
import { queueWebhook } from "../services/webhook.service.js";
import { calculateNextBillingDate } from "../services/billing.service.js";
import { ledgerService } from "../services/ledger.service.js";
import { logger } from "../utils/logger.js";
import { INTERVAL_DAYS } from "../types/subscription.types.js";
import type { PlanInterval } from "../types/subscription.types.js";
import crypto from "node:crypto";
import { env } from "../config/environment.js";
import { queueEmail } from "../utils/emailDispatcher.js";

const router = Router();

async function saveTokenizedCardToCustomer(customerId: any, tokenizedCardData: any) {
  if (!tokenizedCardData || !tokenizedCardData.tokenKey) return;
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  // Set root fields for backwards compatibility
  customer.tokenKey = tokenizedCardData.tokenKey;
  customer.cardLast4 = tokenizedCardData.cardLast4;
  customer.cardBrand = tokenizedCardData.cardBrand;

  // Extract expiry if available, else try to fetch it
  let expiryStr = tokenizedCardData.tokenExpirationDate;
  if (!expiryStr) {
    try {
      const cardList = await nombaService.listTokenizedCards({ customerEmail: customer.email });
      const matchedCard = cardList.tokenizedCardDataList.find(c => c.tokenKey === tokenizedCardData.tokenKey);
      if (matchedCard?.tokenExpirationDate) {
        expiryStr = matchedCard.tokenExpirationDate;
      }
    } catch (error) {
      logger.warn({ customerId }, "Failed to fetch token expiration date from Nomba");
    }
  }

  const existingIndex = customer.paymentMethods.findIndex(
    (pm: any) => pm.methodType === "card" && pm.tokenKey === tokenizedCardData.tokenKey
  );

  if (existingIndex === -1) {
    customer.paymentMethods.forEach((pm: any) => pm.isDefault = false);
    customer.paymentMethods.push({
      methodType: "card",
      isDefault: true,
      tokenKey: tokenizedCardData.tokenKey,
      cardLast4: tokenizedCardData.cardLast4,
      cardBrand: tokenizedCardData.cardBrand,
      tokenExpirationDate: expiryStr,
    } as any);
  } else {
    customer.paymentMethods.forEach((pm: any) => pm.isDefault = false);
    const method = customer.paymentMethods[existingIndex];
    if (method) {
      method.isDefault = true;
      method.cardLast4 = tokenizedCardData.cardLast4;
      method.cardBrand = tokenizedCardData.cardBrand;
      if (expiryStr) {
        method.tokenExpirationDate = expiryStr;
        method.expiryReminderSent = false;
      }
    }
  }

  await customer.save();
}

/**
 * POST /webhooks/nomba
 *
 * Receives incoming webhook events from Nomba.
 * This endpoint is mounted BEFORE body parsers in app.ts to capture raw payloads.
 *
 * Per overall_implementation_plan.md §6.1:
 * When Nomba sends a payment_success webhook:
 * 1. Parse the payload
 * 2. Find the pending Subscription by orderReference
 * 3. Verify transaction via sub-account endpoint
 * 4. Save tokenKey, cardLast4, cardBrand
 * 5. Transition subscription: pending → active
 * 6. Update invoice: pending → paid
 * 7. Set billing period dates
 * 8. Fire webhook: subscription.created
 *
 * Per AGENTS.md §2.2: Sub-account scoped verification
 */
router.post(
  "/nomba",
  express.text({ type: "*/*" }),
  async (req, res) => {
    const rawBody = typeof req.body === "string" ? req.body : String(req.body);
    const headers = req.headers;

    logger.info("=== NOMBA WEBHOOK RECEIVED ===");
    logger.info({ headers }, "Nomba webhook headers");
    logger.info({ rawBody: rawBody.substring(0, 2000) }, "Nomba webhook body");

    // Optional Signature Verification
    if (env.NOMBA_WEBHOOK_SECRET) {
      const signature = headers["nomba-signature"] as string;
      const timestamp = headers["nomba-timestamp"] as string;

      if (!signature || !timestamp) {
        logger.warn("Webhook missing signature headers — rejecting");
        res.status(401).send("Unauthorized");
        return;
      }

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        res.status(400).send("Invalid JSON");
        return;
      }

      const eventType = payload.event_type || "";
      const requestId = payload.requestId || "";
      const data = payload.data || {};
      const merchant = data.merchant || {};
      const transaction = data.transaction || {};
      const userId = merchant.userId || "";
      const walletId = merchant.walletId || "";
      const transactionId = transaction.transactionId || "";
      const transactionType = transaction.type || "";
      const transactionTime = transaction.time || "";
      let transactionResponseCode = transaction.responseCode || "";
      if (transactionResponseCode === "null") {
        transactionResponseCode = "";
      }

      const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timestamp}`;
      
      const hmac = crypto.createHmac("sha256", env.NOMBA_WEBHOOK_SECRET);
      hmac.update(hashingPayload);
      const computedSignature = hmac.digest("base64");

      if (signature !== computedSignature) {
        logger.warn({ expected: computedSignature, received: signature }, "Webhook signature mismatch — rejecting");
        res.status(401).send("Unauthorized");
        return;
      }
    }

    // Immediately return 200 OK to acknowledge receipt after successful auth
    res.status(200).send("OK");

    // Declared outside try/catch so the catch block can reference it
    let webhookRequestId = "";

    try {
      // Parse the webhook payload
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        logger.warn("Webhook body is not valid JSON — ignoring");
        return;
      }

      // === IDEMPOTENCY CHECK ===
      // Extract requestId from the parsed payload.
      // If requestId exists, attempt to insert a WebhookReceipt.
      // If the insert fails with a duplicate-key error (11000),
      // this is a duplicate delivery — no-op and exit.
      webhookRequestId = payload?.requestId || "";
      const webhookEventType = payload?.event_type || "unknown";
      const webhookOrderRef =
        payload?.data?.order?.orderReference ||
        payload?.data?.orderReference ||
        payload?.orderReference ||
        "";

      if (webhookRequestId) {
        try {
          await WebhookReceipt.create({
            requestId: webhookRequestId,
            eventType: webhookEventType,
            orderReference: webhookOrderRef,
            status: "received",
          });
          logger.info(
            { requestId: webhookRequestId, eventType: webhookEventType },
            "Webhook receipt recorded — processing"
          );
        } catch (dedupeError: any) {
          if (dedupeError?.code === 11000) {
            logger.info(
              { requestId: webhookRequestId, eventType: webhookEventType },
              "Duplicate webhook requestId detected — skipping (idempotent no-op)"
            );
            return;
          }
          // Non-duplicate errors should not block processing — log and continue
          logger.warn(
            { requestId: webhookRequestId, error: dedupeError?.message },
            "WebhookReceipt insert failed (non-duplicate) — proceeding with caution"
          );
        }
      } else {
        logger.warn(
          { eventType: webhookEventType },
          "Webhook payload missing requestId — cannot enforce idempotency"
        );
      }

      // 1. Correct Webhook Extraction
      const orderReference =
        payload?.data?.order?.orderReference ||
        payload?.data?.orderReference ||
        payload?.orderReference;

      if (!orderReference) {
        logger.warn({ payload }, "Webhook missing orderReference — ignoring");
        return;
      }

      const paymentStatus =
        payload?.data?.status ||
        payload?.status ||
        payload?.data?.paymentStatus ||
        (payload?.event_type === "payment_success" ? "SUCCESS" : undefined);

      logger.info(
        { orderReference, paymentStatus },
        "Processing Nomba webhook event"
      );

      // Only process successful payments
      if (
        paymentStatus !== "SUCCESS" &&
        paymentStatus !== "APPROVED" &&
        paymentStatus !== "success"
      ) {
        logger.info(
          { orderReference, paymentStatus },
          "Non-success payment status — no action needed"
        );
        return;
      }

      // 2. Global Transaction Verification (Security)
      let verificationTokenizedCardData: {
        tokenKey: string;
        cardLast4: string;
        cardBrand: string;
      } | undefined;

      if (nombaService.isConfigured()) {
        try {
          const verification = await nombaService.verifyTransaction(orderReference);

          if (
            verification.status !== "SUCCESS" &&
            verification.status !== "PENDING_BILLING"
          ) {
            logger.warn(
              {
                orderReference,
                verificationStatus: verification.status,
              },
              "Transaction verification returned invalid status"
            );
            return; // Reject unverified success webhooks
          }

          verificationTokenizedCardData = verification.tokenizedCardData;
        } catch (error) {
          logger.error(
            {
              orderReference,
              error: error instanceof Error ? error.message : "Unknown",
            },
            "Transaction verification failed — processing webhook data directly"
          );
        }
      }

      // 3. Extract Card Data & "N/A" Protection
      let tokenizedCardData = verificationTokenizedCardData;
      if (!tokenizedCardData) {
        const rawCardData = payload?.data?.tokenizedCardData || payload?.tokenizedCardData;
        if (rawCardData && rawCardData.tokenKey && rawCardData.tokenKey !== "N/A") {
          tokenizedCardData = {
            tokenKey: rawCardData.tokenKey,
            cardLast4: rawCardData.cardPan && rawCardData.cardPan !== "N/A" ? rawCardData.cardPan.slice(-4) : "",
            cardBrand: rawCardData.cardType && rawCardData.cardType !== "N/A" ? rawCardData.cardType : "",
          };
        }
      } else {
        // Even from verification, protect against N/A
        if (tokenizedCardData.tokenKey === "N/A") {
          tokenizedCardData = undefined;
        }
      }

      const transactionId =
        payload?.data?.transaction?.transactionId ||
        payload?.data?.transactionId ||
        payload?.transactionId;

      // --- Process Manual Wallet Top-Up ---
      if (orderReference.startsWith("man_topup_")) {
        const invoice = await Invoice.findOne({ nombaOrderReference: orderReference });
        if (invoice && invoice.status === "pending") {
          invoice.status = "paid";
          invoice.paidAt = new Date();
          if (transactionId) invoice.nombaTransactionId = transactionId;
          await invoice.save();

          // Credit Tenant Ledger
          await ledgerService.creditTenant(invoice.tenantId, invoice.amount, invoice._id.toString());

          // Credit Customer Wallet
          const walletId = orderReference.split("_")[2];
          const { creditWallet } = await import("../services/wallet.service.js");
          await creditWallet(walletId, invoice.amount, "Manual Top-Up via Portal");

          // Save card if user opted-in during manual top-up checkout
          if (tokenizedCardData?.tokenKey) {
            await saveTokenizedCardToCustomer(invoice.customerId, tokenizedCardData);
          }

          // Queue wallet topped up email notification to customer
          await queueEmail("customer", "wallet_topped_up", {
            tenantId: invoice.tenantId,
            customerId: invoice.customerId as any,
            topupAmount: invoice.amount,
          });

          logger.info({ walletId, amount: invoice.amount, hasToken: !!tokenizedCardData?.tokenKey }, "Manual wallet top-up successful");
        } else if (invoice) {
          logger.info({ orderReference }, "Manual top-up invoice already paid or failed");
        } else {
          logger.warn({ orderReference }, "Manual top-up invoice not found");
        }
        return;
      }

      // Find subscription by checkout order reference (Initial Checkout)
      const subscription = await Subscription.findOne({
        nombaCheckoutOrderRef: orderReference,
      }).populate("planId");

      if (!subscription) {
        // Try finding by invoice order reference (Manual Renewal)
        const invoice = await Invoice.findOne({
          nombaOrderReference: orderReference,
        });

        if (invoice && invoice.status === "pending") {
          logger.info(
            { orderReference, invoiceId: invoice._id },
            "Webhook matched a pending invoice — processing manual renewal payment"
          );

          // Mark invoice as paid
          invoice.status = "paid";
          invoice.paidAt = new Date();
          if (transactionId) {
            invoice.nombaTransactionId = transactionId;
          }
          await invoice.save();
          
          // Credit tenant ledger
          await ledgerService.creditTenant(invoice.tenantId, invoice.amount, invoice._id.toString());

          // Update subscription
          const sub = await Subscription.findById(invoice.subscriptionId).populate("planId");
          if (sub) {
            // Save tokenized card data if provided (captures new cards from manual payments)
            if (tokenizedCardData?.tokenKey) {
              sub.tokenKey = tokenizedCardData.tokenKey;
              sub.cardLast4 = tokenizedCardData.cardLast4;
              sub.cardBrand = tokenizedCardData.cardBrand;

              await saveTokenizedCardToCustomer(sub.customerId, tokenizedCardData);
            }

            (sub as any)._previousStatus = sub.status;
            sub.status = "active";
            sub.dunningAttemptCount = 0;
            sub.lastDunningAt = undefined;

            if (invoice.targetPlanId) {
              // --- Process Asynchronous Plan Upgrade ---
              const oldPlanId = sub.planId;
              sub.planId = invoice.targetPlanId as any;
              
              // Do NOT advance billing dates for mid-cycle plan changes
              await sub.save();

              await queueWebhook(sub.tenantId, "subscription.updated", {
                subscriptionId: sub._id,
                oldPlanId: oldPlanId,
                newPlanId: invoice.targetPlanId,
                reason: "plan_upgrade",
                invoiceId: invoice._id,
              });

              logger.info(
                { subscriptionId: sub._id, invoiceId: invoice._id, newPlanId: invoice.targetPlanId },
                "Asynchronous plan upgrade payment processed successfully"
              );
            } else {
              // --- Process Manual Renewal ---
              // Advance billing dates
              const now = new Date();
              const plan = sub.planId as any;
              const newPeriodStart = sub.currentPeriodEnd || now;
              const newPeriodEnd = calculateNextBillingDate(
                newPeriodStart,
                plan.interval as PlanInterval,
                plan.intervalDays
              );

              sub.currentPeriodStart = newPeriodStart;
              sub.currentPeriodEnd = newPeriodEnd;
              sub.nextBillingDate = newPeriodEnd;
              await sub.save();

              // Fire webhook
              await queueWebhook(sub.tenantId, "subscription.renewed", {
                subscriptionId: sub._id,
                invoiceId: invoice._id,
                recoveredViaManualPayment: true,
                hasPaymentToken: !!sub.tokenKey,
              });

              logger.info(
                { subscriptionId: sub._id, invoiceId: invoice._id },
                "Manual renewal payment processed successfully"
              );
            }

            // Send receipt email for both
            await queueEmail("customer", "receipt", {
              tenantId: sub.tenantId,
              customerId: sub.customerId as any,
              subscriptionId: sub._id,
              invoiceId: invoice._id,
            });
          }
        } else if (invoice) {
          logger.info(
            { orderReference, invoiceId: invoice._id },
            "Webhook matched an invoice that is already paid or failed"
          );
        } else {
          logger.warn(
            { orderReference },
            "No subscription or invoice found for order reference"
          );
        }
        return;
      }

      // --- Process Initial Checkout ---

      // Only process if subscription is still pending
      if (subscription.status !== "pending") {
        logger.info(
          {
            subscriptionId: subscription._id,
            status: subscription.status,
          },
          "Subscription is not pending — webhook may be a duplicate"
        );
        return;
      }

      // Save tokenized card data on subscription and customer
      if (tokenizedCardData?.tokenKey) {
        subscription.tokenKey = tokenizedCardData.tokenKey;
        subscription.cardLast4 = tokenizedCardData.cardLast4;
        subscription.cardBrand = tokenizedCardData.cardBrand;

        await saveTokenizedCardToCustomer(subscription.customerId, tokenizedCardData);
      }

      const plan = subscription.planId as any;

      if (plan && plan.allowMultipleSubscriptions === false) {
        const existingActive = await Subscription.findOne({
          _id: { $ne: subscription._id },
          tenantId: subscription.tenantId,
          customerId: subscription.customerId,
          planId: plan._id,
          status: { $in: ["active", "past_due"] }
        });

        if (existingActive) {
          logger.error(
            { subscriptionId: subscription._id, customerId: subscription.customerId },
            "CRITICAL: Customer paid for duplicate subscription but plan disallows multiples. Canceling duplicate. Manual refund required."
          );
          
          subscription.status = "canceled";
          await subscription.save();
          // We intentionally skip activating billing period dates below, but we'll still update the invoice to paid so we have a record of the money.
        } else {
          // Transition: pending → active
          (subscription as any)._previousStatus = subscription.status;
          subscription.status = "active";
        }
      } else {
        // Transition: pending → active
        (subscription as any)._previousStatus = subscription.status;
        subscription.status = "active";
      }

      // Set billing period dates
      const now = new Date();
      subscription.currentPeriodStart = now;

      if (plan && plan.interval && subscription.status === "active") {
        const periodEnd = calculateNextBillingDate(now, plan.interval as PlanInterval, plan.intervalDays);
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingDate = periodEnd;
      }

      await subscription.save();

      // Update invoice: pending → paid
      const invoice = await Invoice.findOne({
        subscriptionId: subscription._id,
        status: "pending",
      });

      if (invoice) {
        invoice.status = "paid";
        invoice.paidAt = new Date();
        invoice.nombaOrderReference = orderReference;

        if (transactionId) {
          invoice.nombaTransactionId = transactionId;
        }

        await invoice.save();
        
        // Credit tenant ledger
        await ledgerService.creditTenant(subscription.tenantId, invoice.amount, invoice._id.toString());
      }

      // Fire webhook: subscription.created
      await queueWebhook(subscription.tenantId, "subscription.created", {
        subscriptionId: subscription._id,
        customerId: subscription.customerId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
        hasPaymentToken: !!subscription.tokenKey,
      });

      logger.info(
        {
          subscriptionId: subscription._id,
          hasToken: !!tokenizedCardData?.tokenKey,
          periodEnd: subscription.currentPeriodEnd?.toISOString(),
        },
        "Subscription activated via Nomba webhook"
      );

      // Queue email notifications: welcome (customer) + new_subscriber (tenant)
      const emailContext = {
        tenantId: subscription.tenantId,
        customerId: subscription.customerId as any,
        subscriptionId: subscription._id,
      };
      await queueEmail("customer", "welcome", emailContext);
      await queueEmail("tenant", "new_subscriber", emailContext);

      // Mark the webhook receipt as fully processed
      if (webhookRequestId) {
        await WebhookReceipt.updateOne(
          { requestId: webhookRequestId },
          { $set: { status: "processed" } }
        ).catch((err: any) =>
          logger.warn({ requestId: webhookRequestId, error: err?.message }, "Failed to mark webhook receipt as processed")
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error processing Nomba webhook"
      );

      // Mark the webhook receipt as failed so a retry can be attempted
      if (webhookRequestId) {
        await WebhookReceipt.updateOne(
          { requestId: webhookRequestId },
          { $set: { status: "failed" } }
        ).catch((err: any) =>
          logger.warn({ requestId: webhookRequestId, error: err?.message }, "Failed to mark webhook receipt as failed")
        );
      }
    }
  }
);

export default router;
