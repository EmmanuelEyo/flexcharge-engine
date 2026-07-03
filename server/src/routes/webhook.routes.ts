import { Router } from "express";
import express from "express";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { nombaService } from "../services/nomba.service.js";
import { queueWebhook } from "../services/webhook.service.js";
import { calculateNextBillingDate } from "../services/billing.service.js";
import { logger } from "../utils/logger.js";
import { INTERVAL_DAYS } from "../types/subscription.types.js";
import type { PlanInterval } from "../types/subscription.types.js";
import crypto from "node:crypto";
import { env } from "../config/environment.js";
import { queueEmail } from "../utils/emailDispatcher.js";

const router = Router();

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

    try {
      // Parse the webhook payload
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        logger.warn("Webhook body is not valid JSON — ignoring");
        return;
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

          if (verification.status !== "SUCCESS") {
            logger.warn(
              {
                orderReference,
                verificationStatus: verification.status,
              },
              "Transaction verification returned non-SUCCESS status"
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

          // Update subscription
          const sub = await Subscription.findById(invoice.subscriptionId).populate("planId");
          if (sub) {
            // Save tokenized card data if provided (captures new cards from manual payments)
            if (tokenizedCardData?.tokenKey) {
              sub.tokenKey = tokenizedCardData.tokenKey;
              sub.cardLast4 = tokenizedCardData.cardLast4;
              sub.cardBrand = tokenizedCardData.cardBrand;
            }

            (sub as any)._previousStatus = sub.status;
            sub.status = "active";

            // Advance billing dates
            const now = new Date();
            const plan = sub.planId as any;
            const newPeriodStart = sub.currentPeriodEnd || now;
            const newPeriodEnd = calculateNextBillingDate(
              newPeriodStart,
              plan.interval as PlanInterval
            );

            sub.currentPeriodStart = newPeriodStart;
            sub.currentPeriodEnd = newPeriodEnd;
            sub.nextBillingDate = newPeriodEnd;
            sub.dunningAttemptCount = 0;
            sub.lastDunningAt = undefined;
            await sub.save();

            // Fire webhook
            await queueWebhook(sub.tenantId, "subscription.renewed", {
              subscriptionId: sub._id,
              invoiceId: invoice._id,
              recoveredViaManualPayment: true,
              hasPaymentToken: !!sub.tokenKey,
            });

            // Send receipt email
            await queueEmail("customer", "receipt", {
              tenantId: sub.tenantId,
              customerId: sub.customerId as any,
              subscriptionId: sub._id,
              invoiceId: invoice._id,
            });

            logger.info(
              { subscriptionId: sub._id, invoiceId: invoice._id },
              "Manual renewal payment processed successfully"
            );
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

      // Save tokenized card data on subscription
      if (tokenizedCardData?.tokenKey) {
        subscription.tokenKey = tokenizedCardData.tokenKey;
        subscription.cardLast4 = tokenizedCardData.cardLast4;
        subscription.cardBrand = tokenizedCardData.cardBrand;
      }

      // Transition: pending → active
      (subscription as any)._previousStatus = subscription.status;
      subscription.status = "active";

      // Set billing period dates
      const plan = subscription.planId as any;
      const now = new Date();
      subscription.currentPeriodStart = now;

      if (plan && plan.interval) {
        const periodEnd = calculateNextBillingDate(now, plan.interval as PlanInterval);
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
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error processing Nomba webhook"
      );
    }
  }
);

export default router;
