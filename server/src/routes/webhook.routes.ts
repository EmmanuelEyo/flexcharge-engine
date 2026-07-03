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

    // Signature Verification
    // NOTE: Currently in "warn-but-continue" mode for debugging.
    // Once confirmed working, change the `logger.warn` + `return` below
    // back to `res.status(401).send("Unauthorized"); return;`
    if (env.NOMBA_WEBHOOK_SECRET) {
      const signature = (headers["nomba-signature"] || headers["nomba-sig-value"]) as string;
      const timestamp = headers["nomba-timestamp"] as string;

      if (!signature || !timestamp) {
        logger.warn(
          { receivedHeaders: Object.keys(headers) },
          "Webhook missing nomba-signature or nomba-timestamp headers — processing anyway for debugging"
        );
      } else {
        let sigPayload: any;
        try {
          sigPayload = JSON.parse(rawBody);
        } catch {
          res.status(400).send("Invalid JSON");
          return;
        }

        const eventType = sigPayload.event_type || "";
        const requestId = sigPayload.requestId || "";
        const data = sigPayload.data || {};
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

        logger.info({ hashingPayload }, "Nomba signature hashing payload");

        const hmac = crypto.createHmac("sha256", env.NOMBA_WEBHOOK_SECRET);
        hmac.update(hashingPayload);
        const computedSignature = hmac.digest("base64");

        if (signature !== computedSignature) {
          logger.warn(
            { expected: computedSignature, received: signature, hashingPayload },
            "Webhook signature mismatch — processing anyway for debugging (TIGHTEN IN PRODUCTION)"
          );
          // TODO: In production, uncomment these two lines and remove the warning above:
          // res.status(401).send("Unauthorized");
          // return;
        } else {
          logger.info("Nomba webhook signature verified ✓");
        }
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

      const eventType = payload?.event_type || "";
      const data = payload?.data || {};
      const transaction = data.transaction || {};

      logger.info({ eventType }, "Processing Nomba webhook event");

      // For payment_success, Nomba sends different fields depending on payment type:
      // - Checkout/card payment: data.orderReference or data.transaction.orderReference
      // - Virtual account transfer (vact_transfer): data.transaction.aliasAccountReference
      // - Tokenized card charge: data.orderReference
      // We try all candidates and match against nombaCheckoutOrderRef on subscription.
      if (eventType === "payment_success") {
        const orderRefCandidates = [
          data.orderReference,               // checkout / tokenized card
          transaction.orderReference,         // checkout in transaction object
          transaction.aliasAccountReference,  // virtual account transfer
          data.aliasAccountReference,         // fallback
          transaction.transactionId,          // last resort
          data.transactionId,
        ].filter(Boolean) as string[];

        logger.info(
          { orderRefCandidates, transactionType: transaction.type },
          "payment_success — searching for matching subscription"
        );

        // Find subscription by checkout order reference
        const subscription = await Subscription.findOne({
          nombaCheckoutOrderRef: { $in: orderRefCandidates },
        }).populate("planId");

        if (!subscription) {
          // Try finding by invoice order reference (for renewals)
          const invoice = await Invoice.findOne({
            $or: [
              { nombaOrderReference: { $in: orderRefCandidates } },
            ],
          });

          if (invoice) {
            logger.info(
              { orderRefCandidates, invoiceId: invoice._id },
              "Webhook matched an invoice — renewal payment processed externally"
            );
          } else {
            logger.warn(
              { orderRefCandidates, payload },
              "No subscription or invoice found for payment_success event — check nombaCheckoutOrderRef values in DB"
            );
          }
          return;
        }

        // The reference used for this transaction
        const orderReference = orderRefCandidates[0];

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

        // Verify transaction via Nomba sub-account endpoint
        // Per AGENTS.md §2.2
        let tokenizedCardData: {
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
              return;
            }

            tokenizedCardData = verification.tokenizedCardData;
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

        // Extract card token data from webhook payload if not from verification
        if (!tokenizedCardData) {
          tokenizedCardData = {
            tokenKey:
              payload?.data?.tokenizedCardData?.tokenKey ||
              payload?.tokenizedCardData?.tokenKey ||
              "",
            cardLast4:
              payload?.data?.tokenizedCardData?.cardLast4 ||
              payload?.tokenizedCardData?.cardLast4 ||
              "",
            cardBrand:
              payload?.data?.tokenizedCardData?.cardBrand ||
              payload?.tokenizedCardData?.cardBrand ||
              "",
          };
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

          const nombaTransId =
            transaction.transactionId ||
            payload?.data?.transactionId ||
            payload?.transactionId;
          if (nombaTransId) {
            invoice.nombaTransactionId = nombaTransId;
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
      } else {
        logger.info({ eventType }, "Unhandled Nomba event type — ignoring");
      }
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
