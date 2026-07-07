import { Request, Response } from "express";
import { TenantLedger } from "../models/TenantLedger.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { Tenant } from "../models/Tenant.js";
import { Invoice } from "../models/Invoice.js";
import { ledgerService } from "../services/ledger.service.js";
import { nombaService } from "../services/nomba.service.js";
import { logger } from "../utils/logger.js";
import { queueEmail } from "../utils/emailDispatcher.js";

// ============================================================
// DASHBOARD & DEVELOPER READ-ONLY APIS
// ============================================================

/**
 * GET /ledger/balance (Dashboard) or /v1/ledger (API)
 * Retrieve the tenant's current balance and recent transactions.
 */
export async function getLedgerBalance(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantId;

    let ledger = await TenantLedger.findOne({ tenantId });
    if (!ledger) {
      // Create empty ledger if none exists
      ledger = await TenantLedger.create({ tenantId, availableBalance: 0, totalWithdrawn: 0 });
    }

    const transactions = await LedgerTransaction.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Also get bank account details if configured
    const tenant = await Tenant.findById(tenantId).select("settlementAccount");

    res.json({
      success: true,
      data: {
        availableBalance: ledger.availableBalance,
        totalWithdrawn: ledger.totalWithdrawn,
        settlementAccount: tenant?.settlementAccount,
        recentTransactions: transactions,
      },
    });
  } catch (error) {
    logger.error({ error, tenantId: req.tenantId }, "Error fetching ledger balance");
    res.status(500).json({ error: "Failed to fetch ledger balance" });
  }
}

// ============================================================
// BANK ACCOUNT CONFIGURATION (DASHBOARD ONLY)
// ============================================================

/**
 * POST /ledger/bank-account
 * Set the tenant's settlement bank account for withdrawals.
 */
export async function setBankAccount(req: Request, res: Response): Promise<void> {
  try {
    const { bankCode, accountNumber } = req.body;
    const tenantId = req.tenantId;

    if (!bankCode || !accountNumber) {
      res.status(400).json({ error: "bankCode and accountNumber are required" });
      return;
    }

    // Lookup the account name via Nomba
    const lookupResult = await nombaService.lookupBankAccount(bankCode, accountNumber);
    
    if (!lookupResult.accountName) {
      res.status(400).json({ error: "Could not verify bank account details" });
      return;
    }

    // Save to Tenant model
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    tenant.settlementAccount = {
      bankCode,
      accountNumber,
      accountName: lookupResult.accountName,
    };
    
    await tenant.save();

    // Notify developer/tenant of bank account change
    await queueEmail("tenant", "bank_account_changed", {
      tenantId: tenantId!,
      bankName: lookupResult.accountName, // Or fetch actual bank name but accountName has context
      accountNumber,
    });

    res.json({
      success: true,
      message: "Bank account configured successfully",
      data: tenant.settlementAccount,
    });
  } catch (error) {
    logger.error({ error, body: req.body }, "Error configuring bank account");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to configure bank account" });
  }
}

/**
 * GET /ledger/dashboard/banks
 * Fetch the list of banks from Nomba.
 */
export async function getBanksList(req: Request, res: Response): Promise<void> {
  try {
    const banks = await nombaService.getBanks();
    res.json({
      success: true,
      data: banks,
    });
  } catch (error) {
    logger.error({ error, tenantId: req.tenantId }, "Error fetching bank list");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch bank list" });
  }
}

/**
 * GET /ledger/dashboard/lookup-bank?bankCode=...&accountNumber=...
 * Look up a bank account name via Nomba before saving.
 * Returns the resolved account name so the frontend can display it
 * for user confirmation in the modal.
 */
export async function lookupBankAccount(req: Request, res: Response): Promise<void> {
  try {
    const { bankCode, accountNumber } = req.query;

    if (!bankCode || !accountNumber || typeof bankCode !== "string" || typeof accountNumber !== "string") {
      res.status(400).json({ error: "bankCode and accountNumber query parameters are required" });
      return;
    }

    if (accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber)) {
      res.status(400).json({ error: "Account number must be exactly 10 digits" });
      return;
    }

    const result = await nombaService.lookupBankAccount(bankCode, accountNumber);

    if (!result.accountName) {
      res.status(404).json({ error: "Could not resolve account name for the provided details" });
      return;
    }

    res.json({
      success: true,
      data: {
        accountName: result.accountName,
        bankCode,
        accountNumber,
      },
    });
  } catch (error) {
    logger.error({ error, query: req.query }, "Error looking up bank account");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to look up bank account" });
  }
}

// ============================================================
// WITHDRAWALS
// ============================================================

/**
 * POST /ledger/withdraw (Dashboard) or /v1/withdrawals (API)
 * Request a payout to the configured settlement bank account.
 */
export async function requestWithdrawal(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantId!;
    const { amount } = req.body; // in KOBO

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "A valid positive amount in KOBO is required" });
      return;
    }

    await ledgerService.processWithdrawal(tenantId, amount);

    res.json({
      success: true,
      message: "Withdrawal processed successfully",
    });
  } catch (error) {
    logger.error({ error, tenantId: req.tenantId }, "Error processing withdrawal");
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to process withdrawal" });
  }
}

// ============================================================
// REFUNDS (DEVELOPER API ONLY)
// ============================================================

/**
 * POST /v1/refunds
 * Refund a completed checkout transaction.
 */
export async function processRefund(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantId!;
    const { invoiceId, accountNumber, bankCode } = req.body;

    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    // Verify invoice belongs to tenant and is paid
    const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found or does not belong to tenant" });
      return;
    }

    if (invoice.status !== "paid") {
      res.status(400).json({ error: "Invoice is not paid" });
      return;
    }

    if (!invoice.nombaTransactionId) {
      res.status(400).json({ error: "Invoice does not have an associated Nomba transaction ID to refund" });
      return;
    }

    // Verify payment method and transaction age on Nomba before attempting refund
    if (invoice.nombaOrderReference) {
      try {
        const txInfo = await nombaService.fetchCheckoutTransaction(invoice.nombaOrderReference, "ORDER_REFERENCE");
        
        // Check 1: Payment Method (Bank Transfer refunds are not programmatically supported by Nomba API)
        if (txInfo.transferDetails) {
          res.status(400).json({
            error: "Automated refunds are not supported for bank transfers. Please process a manual transfer off-platform."
          });
          return;
        }

        // Check 2: Transaction Age (Transactions older than 24 hours are settled and cannot be programmatically reversed)
        if (txInfo.transactionDetails?.transactionDate) {
          const txDate = new Date(txInfo.transactionDetails.transactionDate);
          const hoursAge = (Date.now() - txDate.getTime()) / (1000 * 60 * 60);
          if (hoursAge > 24) {
            res.status(400).json({
              error: "Automated refunds are not supported for transactions older than 24 hours. Please process a manual transfer off-platform."
            });
            return;
          }
        }
      } catch (error) {
        logger.error({ error, invoiceId }, "Error verifying transaction eligibility on Nomba");
        // If Nomba API errors on fetching, we proceed to let ledgerService handle the refund call
      }
    }

    const bankDetails = accountNumber && bankCode ? { accountNumber, bankCode } : undefined;

    await ledgerService.processRefund(
      tenantId!,
      invoiceId,
      invoice.nombaTransactionId,
      invoice.amount,
      bankDetails
    );

    // Mark invoice as refunded
    invoice.status = "refunded";
    await invoice.save();

    res.json({
      success: true,
      message: "Refund processed successfully",
    });
  } catch (error) {
    logger.error({ error, body: req.body }, "Error processing refund");
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to process refund" });
  }
}
