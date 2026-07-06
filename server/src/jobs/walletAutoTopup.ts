import { Agenda } from "agenda";
import { Wallet } from "../models/Wallet.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { nombaService } from "../services/nomba.service.js";
import { creditWallet } from "../services/wallet.service.js";
import { ledgerService } from "../services/ledger.service.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/environment.js";
import { queueEmail } from "../utils/emailDispatcher.js";

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
      const walletsNeedingTopUp = await Wallet.find({
        autoTopUp: true,
        isActive: true,
        $expr: { $lte: ["$balance", "$autoTopUpTrigger"] },
      }).populate("customerId");

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

          const customer = wallet.customerId as any;

          if (!customer) {
            logger.warn({ walletId: wallet._id }, "Wallet auto top-up failed: Customer not found");
            continue;
          }

          const defaultMethod = customer.paymentMethods?.find((pm: any) => pm.isDefault);
          
          let paymentType: "card" | "direct_debit" | null = null;
          let tokenKey: string | undefined = undefined;
          let mandateId: string | undefined = undefined;

          if (defaultMethod) {
            if (defaultMethod.methodType === "card" && defaultMethod.tokenKey) {
              paymentType = "card";
              tokenKey = defaultMethod.tokenKey;
            } else if (defaultMethod.methodType === "direct_debit" && defaultMethod.mandateStatus === "ACTIVE" && defaultMethod.mandateId) {
              paymentType = "direct_debit";
              mandateId = defaultMethod.mandateId;
            }
          }

          // Fallback to legacy top-level customer tokenKey
          if (!paymentType && customer.tokenKey) {
            paymentType = "card";
            tokenKey = customer.tokenKey;
          }
          
          if (!paymentType) {
            logger.warn(
              { walletId: wallet._id, customerId: customer._id },
              "Wallet auto top-up failed: No active default payment method or top-level card found"
            );
            continue;
          }

          // Concurrency Lock: Check if there's already a pending top-up in the last 15 minutes
          const lockThreshold = new Date(Date.now() - 15 * 60 * 1000);
          const pendingTopup = await Invoice.findOne({
            customerId: customer._id,
            description: "Wallet Auto Top-Up",
            status: "pending",
            createdAt: { $gte: lockThreshold }
          });

          if (pendingTopup) {
            logger.warn(
              { walletId: wallet._id, pendingInvoiceId: pendingTopup._id },
              "Skipping wallet auto top-up: another top-up is currently in progress."
            );
            continue;
          }

          // Charge via Nomba
          const orderReference = `topup_${wallet._id}_${Date.now()}`;
          const amount = wallet.autoTopUpAmount;

          const invoice = await Invoice.create({
            tenantId: wallet.tenantId,
            customerId: customer._id,
            amount,
            currency: wallet.currency,
            status: "pending",
            nombaOrderReference: orderReference,
            description: "Wallet Auto Top-Up",
            isRenewal: false,
          });

          let chargeSuccess = false;
          let chargeMessage = "";
          let requiresOTP = false;

          if (paymentType === "direct_debit" && mandateId) {
            logger.info(
              { walletId: wallet._id, customerId: customer._id, mandateId },
              "Charging direct debit mandate for wallet auto top-up"
            );
            const debitResult = await nombaService.debitMandate(mandateId, amount);
            chargeSuccess = debitResult.success;
            chargeMessage = debitResult.message;
          } else if (paymentType === "card" && tokenKey) {
            const chargeResult = await nombaService.chargeTokenizedCard({
              tokenKey,
              orderReference,
              amount,
              currency: wallet.currency as "NGN" | "CDF" | "USD" | undefined,
              customerEmail: customer.email,
              customerId: customer._id.toString(),
            });
            chargeSuccess = chargeResult.success;
            chargeMessage = chargeResult.message || "";
            requiresOTP = chargeResult.requiresOTP || false;
          }

          if (chargeSuccess) {
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

            // Credit tenant ledger
            await ledgerService.creditTenant(
              wallet.tenantId,
              amount,
              invoice._id.toString()
            );

            // Queue wallet topped up email notification to customer
            await queueEmail("customer", "wallet_topped_up", {
              tenantId: wallet.tenantId,
              customerId: customer._id,
              topupAmount: amount,
            });

            logger.info(
              { walletId: wallet._id, amount },
              "Wallet auto top-up successful"
            );
          } else if (!chargeSuccess && requiresOTP) {
            // === OTP REQUIRED FALLBACK ===
            const checkoutResult = await nombaService.createCheckoutOrder({
              orderReference,
              amount,
              currency: wallet.currency as "NGN" | "CDF" | "USD" | undefined,
              customerEmail: customer.email,
              callbackUrl: `${env.FRONTEND_URL}/success?orderRef=${orderReference}`,
              tokenizeCard: false,
            });

            invoice.checkoutLink = checkoutResult.checkoutLink;
            invoice.status = "failed";
            invoice.failureReason = "Bank requires OTP. Manual action required.";
            await invoice.save();

            // Queue a generic manual invoice email (or a specific wallet top-up one if it exists)
            // Reusing manual_invoice for now
            await queueEmail("customer", "manual_invoice", {
              tenantId: wallet.tenantId,
              customerId: customer._id,
              invoiceId: invoice._id,
            });

            logger.warn(
              { walletId: wallet._id, reason: invoice.failureReason },
              "Wallet auto top-up requires OTP. Generated checkout link."
            );
          } else {
            // Failed charge
            invoice.status = "failed";
            invoice.failureReason = chargeMessage || "Payment declined";
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
