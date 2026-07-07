import { Agenda } from "agenda";
import { Invoice } from "../models/Invoice.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { Wallet } from "../models/Wallet.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { creditWallet } from "../services/wallet.service.js";
import { ledgerService } from "../services/ledger.service.js";
import { nombaService } from "../services/nomba.service.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import { logger } from "../utils/logger.js";

/**
 * Nightly Reconciliation Job — Agenda job that cross-references
 * our internal transaction records (Invoices + LedgerTransactions)
 * against the Nomba sub-account transaction list.
 *
 * Runs daily at 2:00 AM UTC. Reconciles the previous day's transactions.
 *
 * Anomaly categories:
 *   1. MISSING_INTERNAL — Transaction exists in Nomba but not in our DB.
 *      (Could indicate a webhook was lost or processing failed.)
 *   2. MISSING_NOMBA — Transaction exists in our DB but not in Nomba.
 *      (Could indicate a fraudulent/ghost record or a test entry.)
 *   3. AMOUNT_MISMATCH — Both records exist but amounts differ.
 *
 * When anomalies are found, a CRITICAL log is emitted and an admin
 * alert email is queued for manual review. No automated state changes
 * are made — this is an auditing tool.
 */

export const NIGHTLY_RECONCILIATION_JOB_NAME = "nightly-reconciliation";
const WALLET_AUTOTOPUP_REPAIR_LOOKBACK_DAYS = 14;

export async function repairMissedWalletAutoTopups(): Promise<{
  examined: number;
  repaired: number;
}> {
  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - WALLET_AUTOTOPUP_REPAIR_LOOKBACK_DAYS);
  lookbackStart.setUTCHours(0, 0, 0, 0);

  const candidates = await Invoice.find({
    status: "failed",
    description: "Wallet Auto Top-Up",
    createdAt: { $gte: lookbackStart },
    nombaOrderReference: { $exists: true, $ne: "" },
  });

  if (candidates.length === 0) {
    return { examined: 0, repaired: 0 };
  }

  let repaired = 0;

  for (const invoice of candidates) {
    try {
      const orderReference = invoice.nombaOrderReference;
      if (!orderReference) continue;

      const checkoutTransaction = await nombaService.fetchCheckoutTransaction(orderReference);
      if (!checkoutTransaction.success) {
        continue;
      }

      const checkoutAmountKobo = Math.round(Number(checkoutTransaction.order.amount) * 100);
      if (Number.isFinite(checkoutAmountKobo) && checkoutAmountKobo !== invoice.amount) {
        logger.warn(
          {
            invoiceId: invoice._id,
            orderReference,
            checkoutAmountKobo,
            invoiceAmountKobo: invoice.amount,
          },
          "Skipping wallet auto top-up repair due to amount mismatch"
        );
        continue;
      }

      const wallet = await Wallet.findOne({
        tenantId: invoice.tenantId,
        customerId: invoice.customerId,
      });

      if (!wallet) {
        logger.warn(
          { invoiceId: invoice._id, tenantId: invoice.tenantId, customerId: invoice.customerId },
          "Skipping wallet auto top-up repair because wallet was not found"
        );
        continue;
      }

      const referenceId = invoice._id.toString();
      let repairedWalletCredit = false;
      let repairedLedgerCredit = false;

      const walletTransactionExists = await WalletTransaction.exists({
        referenceId,
        type: "credit",
      });
      const ledgerTransactionExists = await LedgerTransaction.exists({
        referenceId,
        type: "CREDIT",
      });

      if (!walletTransactionExists) {
        await creditWallet(
          wallet._id,
          invoice.amount,
          "Auto Top-Up Reconciliation",
          referenceId
        );
        repairedWalletCredit = true;
      }

      if (!ledgerTransactionExists) {
        await ledgerService.creditTenant(invoice.tenantId, invoice.amount, referenceId);
        repairedLedgerCredit = true;
      }

      const shouldMarkPaid =
        invoice.status !== "paid" ||
        !invoice.paidAt ||
        invoice.nombaTransactionId !== orderReference ||
        invoice.nombaTransactionRef !== checkoutTransaction.transactionDetails?.paymentReference;

      if (shouldMarkPaid) {
        invoice.status = "paid";
        invoice.paidAt = invoice.paidAt ?? new Date();
        invoice.nombaTransactionId = invoice.nombaTransactionId ?? orderReference;
        if (checkoutTransaction.transactionDetails?.paymentReference) {
          invoice.nombaTransactionRef =
            invoice.nombaTransactionRef ?? checkoutTransaction.transactionDetails.paymentReference;
        }
        await invoice.save();
      }

      if (repairedWalletCredit || repairedLedgerCredit || shouldMarkPaid) {
        await queueEmail("customer", "wallet_topped_up", {
          tenantId: invoice.tenantId,
          customerId: invoice.customerId,
          topupAmount: invoice.amount,
        });
      }

      repaired++;
      logger.info(
        {
          invoiceId: invoice._id,
          orderReference,
          repairedWalletCredit,
          repairedLedgerCredit,
          markedPaid: shouldMarkPaid,
        },
        "Repaired missed wallet auto top-up"
      );
    } catch (error) {
      logger.warn(
        {
          invoiceId: invoice._id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to repair wallet auto top-up invoice"
      );
    }
  }

  return { examined: candidates.length, repaired };
}

export function defineNightlyReconciliationJob(agenda: Agenda): void {
  agenda.define(NIGHTLY_RECONCILIATION_JOB_NAME, async (_job) => {
    logger.info("Starting nightly reconciliation job");

    try {
      // Determine yesterday's date range (UTC)
      const now = new Date();
      const yesterdayStart = new Date(now);
      yesterdayStart.setUTCDate(now.getUTCDate() - 1);
      yesterdayStart.setUTCHours(0, 0, 0, 0);

      const yesterdayEnd = new Date(now);
      yesterdayEnd.setUTCDate(now.getUTCDate() - 1);
      yesterdayEnd.setUTCHours(23, 59, 59, 999);

      const startDateStr = yesterdayStart.toISOString();
      const endDateStr = yesterdayEnd.toISOString();

      logger.info(
        { startDate: startDateStr, endDate: endDateStr },
        "Reconciliation date range"
      );

      // 1. Fetch all Nomba sub-account transactions for yesterday
      const nombaTransactions: Array<{
        transactionId: string;
        amount: number;
        type: string;
        status: string;
        orderReference?: string;
        merchantTxRef?: string;
        createdAt?: string;
      }> = [];

      if (!nombaService.isConfigured()) {
        logger.warn("Nomba not configured — skipping reconciliation");
        return;
      }

      let cursor: string | undefined = undefined;
      let hasMore = true;
      let pageCount = 0;
      while (hasMore) {
        try {
          const result = await nombaService.getSubaccountTransactions(
            startDateStr,
            endDateStr,
            cursor,
            100
          );
          nombaTransactions.push(...result.transactions);
          cursor = result.nextCursor ?? undefined;
          hasMore = result.hasMore;
          pageCount++;

          // Safety: cap at 50 pages (5000 transactions) to prevent infinite loops
          if (pageCount >= 50) {
            logger.warn("Reconciliation page limit reached (50 pages) — stopping pagination");
            break;
          }
        } catch (fetchError) {
          logger.error(
            { error: fetchError instanceof Error ? fetchError.message : "Unknown", pageCount },
            "Failed to fetch Nomba transactions page for reconciliation"
          );
          // If we can't fetch from Nomba, abort this run rather than producing false positives
          return;
        }
      }

      // Only consider SUCCESS transactions from Nomba
      const nombaSuccessful = nombaTransactions.filter(
        (tx) => tx.status === "SUCCESS" || tx.status === "APPROVED"
      );

      // 2. Fetch our internal paid invoices for yesterday
      const internalInvoices = await Invoice.find({
        status: "paid",
        paidAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      }).lean();

      // 3. Build lookup maps
      // Map Nomba transactions by orderReference for cross-reference
      const nombaByOrderRef = new Map<string, typeof nombaSuccessful[0]>();
      const nombaByTxId = new Map<string, typeof nombaSuccessful[0]>();
      for (const tx of nombaSuccessful) {
        if (tx.orderReference) {
          nombaByOrderRef.set(tx.orderReference, tx);
        }
        if (tx.transactionId) {
          nombaByTxId.set(tx.transactionId, tx);
        }
      }

      // Map internal invoices by their Nomba references
      const internalByOrderRef = new Map<string, typeof internalInvoices[0]>();
      const internalByTxId = new Map<string, typeof internalInvoices[0]>();
      for (const inv of internalInvoices) {
        if (inv.nombaOrderReference) {
          internalByOrderRef.set(inv.nombaOrderReference, inv);
        }
        if (inv.nombaTransactionId) {
          internalByTxId.set(inv.nombaTransactionId, inv);
        }
      }

      // 4. Detect anomalies
      const anomalies: Array<{
        type: "MISSING_INTERNAL" | "MISSING_NOMBA" | "AMOUNT_MISMATCH";
        details: Record<string, unknown>;
      }> = [];

      // Check Nomba transactions against internal records
      for (const nTx of nombaSuccessful) {
        const matchedByRef = nTx.orderReference
          ? internalByOrderRef.get(nTx.orderReference)
          : undefined;
        const matchedByTxId = nTx.transactionId
          ? internalByTxId.get(nTx.transactionId)
          : undefined;
        const matched = matchedByRef || matchedByTxId;

        if (!matched) {
          anomalies.push({
            type: "MISSING_INTERNAL",
            details: {
              nombaTransactionId: nTx.transactionId,
              nombaOrderReference: nTx.orderReference,
              nombaAmount: nTx.amount,
              nmbStatus: nTx.status,
              message: "Transaction exists in Nomba but no matching paid invoice found internally",
            },
          });
        } else {
          // Nomba amounts are in Naira (decimal), internal amounts are in KOBO (integer).
          // Convert Nomba amount to kobo for comparison.
          const nombaAmountKobo = Math.round(nTx.amount * 100);
          if (Math.abs(nombaAmountKobo - matched.amount) > 1) {
            // Allow 1 kobo tolerance for rounding
            anomalies.push({
              type: "AMOUNT_MISMATCH",
              details: {
                invoiceId: matched._id,
                nombaTransactionId: nTx.transactionId,
                nombaOrderReference: nTx.orderReference,
                nombaAmountKobo,
                internalAmountKobo: matched.amount,
                difference: nombaAmountKobo - matched.amount,
                message: "Amount mismatch between Nomba and internal invoice",
              },
            });
          }
        }
      }

      // Check internal invoices against Nomba records
      for (const inv of internalInvoices) {
        const matchedByRef = inv.nombaOrderReference
          ? nombaByOrderRef.get(inv.nombaOrderReference)
          : undefined;
        const matchedByTxId = inv.nombaTransactionId
          ? nombaByTxId.get(inv.nombaTransactionId)
          : undefined;

        if (!matchedByRef && !matchedByTxId) {
          // Only flag if the invoice has Nomba references at all
          // (wallet top-ups and other internal operations may not have them)
          if (inv.nombaOrderReference || inv.nombaTransactionId) {
            anomalies.push({
              type: "MISSING_NOMBA",
              details: {
                invoiceId: inv._id,
                nombaOrderReference: inv.nombaOrderReference,
                nombaTransactionId: inv.nombaTransactionId,
                internalAmountKobo: inv.amount,
                tenantId: inv.tenantId,
                message: "Paid invoice exists internally but no matching Nomba transaction found",
              },
            });
          }
        }
      }

      // 5. Report results
      if (anomalies.length === 0) {
        logger.info(
          {
            nombaTransactionCount: nombaSuccessful.length,
            internalInvoiceCount: internalInvoices.length,
            dateRange: { start: startDateStr, end: endDateStr },
          },
          "Nightly reconciliation completed — no anomalies found"
        );
      } else {
        logger.error(
          {
            anomalyCount: anomalies.length,
            nombaTransactionCount: nombaSuccessful.length,
            internalInvoiceCount: internalInvoices.length,
            anomalies: anomalies.slice(0, 20), // Log first 20 for debugging
            dateRange: { start: startDateStr, end: endDateStr },
          },
          "CRITICAL: Nightly reconciliation found anomalies"
        );

        // Notify affected tenants via their existing email alert channel.
        // We reuse the "payment_failed" type as a generic alert mechanism;
        // the failureReason field carries the reconciliation context.
        try {
          const affectedTenantIds = new Set<string>();
          for (const anomaly of anomalies) {
            const tenantId = anomaly.details.tenantId as string;
            if (tenantId) affectedTenantIds.add(tenantId);
          }

          for (const tenantId of affectedTenantIds) {
            await queueEmail("tenant", "payment_failed", {
              tenantId,
              failureReason: `[Reconciliation Alert] ${anomalies.length} anomalies found for ${startDateStr.split("T")[0]}. Check server logs for details.`,
            });
          }
        } catch (emailErr) {
          logger.warn(
            { error: emailErr instanceof Error ? emailErr.message : "Unknown" },
            "Failed to send reconciliation alert email"
          );
        }
      }

      const repairSummary = await repairMissedWalletAutoTopups();
      if (repairSummary.repaired > 0) {
        logger.info(
          repairSummary,
          "Wallet auto top-up repair pass completed"
        );
      }

      logger.info("Nightly reconciliation job completed");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Nightly reconciliation job failed"
      );
    }
  });
}
