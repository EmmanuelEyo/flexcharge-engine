import { Agenda } from "agenda";
import { Wallet } from "../models/Wallet.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { nombaService } from "../services/nomba.service.js";
import { creditWallet } from "../services/wallet.service.js";
import { logger } from "../utils/logger.js";

/**
 * Wallet Auto Top-Up Job — Scans for depleted wallets and refills them.
 *
 * Runs every 5 minutes.
 * Finds wallets where:
 * 1. autoTopUp = true
 * 2. balance <= autoTopUpTrigger
 * 3. Has an active subscription with a valid payment token
 *
 * Charges the tokenized card via Nomba and credits the wallet.
 *
 * Per feature_implementation_blueprint.md §1
 */

export const WALLET_AUTO_TOPUP_JOB_NAME = "wallet-auto-topup-scan";

export function defineWalletAutoTopupJob(agenda: Agenda): void {
  agenda.define(WALLET_AUTO_TOPUP_JOB_NAME, async (_job) => {
    try {
      // Find wallets needing top-up
      // Note: MongoDB cannot do field-to-field comparison directly in find without $expr
      const walletsNeedingTopUp = await Wallet.find({
        autoTopUp: true,
        isActive: true,
        subscriptionId: { $exists: true },
        $expr: { $lte: ["$balance", "$autoTopUpTrigger"] },
      });

      if (walletsNeedingTopUp.length === 0) {
        logger.debug("No wallets need auto top-up");
        return;
      }

      logger.info(
        { count: walletsNeedingTopUp.length },
        "Processing wallet auto top-ups"
      );

      for (const wallet of walletsNeedingTopUp) {
        try {
          // Verify auto top up amount is set
          if (!wallet.autoTopUpAmount) {
            logger.warn({ walletId: wallet._id }, "Auto top-up amount not configured");
            continue;
          }

          // Get the subscription to find the payment token
          const subscription = await Subscription.findById(wallet.subscriptionId)
            .populate("customerId");

          if (!subscription || subscription.status !== "active" || !subscription.tokenKey) {
            logger.warn(
              { walletId: wallet._id, subscriptionId: wallet.subscriptionId },
              "Wallet linked to invalid or un-tokenized subscription — skipping auto top-up"
            );
            continue;
          }

          const customer = subscription.customerId as any;

          // Charge via Nomba
          const orderReference = `topup_${wallet._id}_${Date.now()}`;
          const amount = wallet.autoTopUpAmount;

          const invoice = await Invoice.create({
            tenantId: wallet.tenantId,
            subscriptionId: subscription._id,
            customerId: customer._id,
            amount,
            currency: wallet.currency,
            status: "pending",
            nombaOrderReference: orderReference,
            description: "Wallet Auto Top-Up",
            isRenewal: false,
          });

          const chargeResult = await nombaService.chargeTokenizedCard({
            tokenKey: subscription.tokenKey,
            orderReference,
            amount,
            currency: wallet.currency as "NGN" | "CDF" | "USD" | undefined,
            customerEmail: customer.email,
            customerId: customer._id.toString(),
          });

          if (chargeResult.success) {
            // Update invoice
            invoice.status = "paid";
            invoice.paidAt = new Date();
            invoice.nombaTransactionId = orderReference;
            await invoice.save();

            // Credit wallet
            await creditWallet(
              wallet._id as any,
              amount,
              "Auto Top-Up",
              invoice._id.toString()
            );

            logger.info(
              { walletId: wallet._id, amount },
              "Wallet auto top-up successful"
            );
          } else {
            // Failed charge
            invoice.status = "failed";
            invoice.failureReason = chargeResult.message || "Payment declined";
            await invoice.save();

            logger.warn(
              { walletId: wallet._id, reason: invoice.failureReason },
              "Wallet auto top-up charge failed"
            );
          }
        } catch (error) {
          logger.error(
            {
              walletId: wallet._id,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Unexpected error processing wallet top-up"
          );
        }
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Wallet auto top-up scan failed"
      );
    }
  });
}
