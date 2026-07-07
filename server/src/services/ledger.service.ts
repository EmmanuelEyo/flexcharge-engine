import { Types } from "mongoose";
import { TenantLedger } from "../models/TenantLedger.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { nombaService } from "./nomba.service.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import { logger } from "../utils/logger.js";
import { Tenant } from "../models/Tenant.js";

class LedgerService {
  /**
   * Credit the tenant's ledger after a successful customer payment.
   * Currently, the platform fee is 0%, so 100% of the invoice amount is credited.
   *
   * @param tenantId - The tenant's ID
   * @param amount - The amount in KOBO
   * @param invoiceId - The associated invoice ID
   */
  async creditTenant(tenantId: Types.ObjectId | string, amount: number, invoiceId: string): Promise<void> {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? undefined : await TenantLedger.startSession();
    if (session) session.startTransaction();

    try {
      // Find or create the ledger
      let ledger = await TenantLedger.findOne({ tenantId }).session(session || null);
      if (!ledger) {
        ledger = new TenantLedger({ tenantId, availableBalance: 0, totalWithdrawn: 0 });
      }

      // 0% platform fee
      const netAmount = amount;

      ledger.availableBalance += netAmount;
      await ledger.save(session ? { session } : undefined);

      // Create ledger transaction log
      await LedgerTransaction.create(
        [
          {
            tenantId,
            type: "CREDIT",
            amount: netAmount,
            description: `Payment received for Invoice ${invoiceId}`,
            referenceId: invoiceId,
            status: "SUCCESS",
          },
        ],
        session ? { session } : undefined
      );

      if (session) await session.commitTransaction();
      logger.info({ tenantId, amount: netAmount, invoiceId }, "Tenant ledger credited successfully");
    } catch (error) {
      if (session) await session.abortTransaction();
      logger.error({ tenantId, amount, error }, "Failed to credit tenant ledger");
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Process a withdrawal from the tenant's ledger to their bank account.
   *
   * @param tenantId - The tenant's ID
   * @param amount - The amount to withdraw in KOBO
   */
  async processWithdrawal(tenantId: Types.ObjectId | string, amount: number): Promise<void> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    
    if (!tenant.settlementAccount || !tenant.settlementAccount.accountNumber) {
      throw new Error("Tenant does not have a configured settlement bank account");
    }

    const { bankCode, accountNumber, accountName } = tenant.settlementAccount;

    const ledger = await TenantLedger.findOne({ tenantId });
    if (!ledger) throw new Error("Ledger not found");

    if (ledger.availableBalance < amount) {
      throw new Error("Insufficient ledger balance for withdrawal");
    }

    // === PRE-WITHDRAWAL BANK VERIFICATION ===
    // Re-verify the settlement account before every withdrawal to catch
    // closed accounts, changed ownership, or stale details.
    try {
      const verifyResult = await nombaService.lookupBankAccount(bankCode, accountNumber);
      if (!verifyResult.accountName) {
        throw new Error(
          "Bank account verification failed: Could not resolve account name. " +
          "Please update your settlement bank account details."
        );
      }

      // Compare account names (case-insensitive, trimmed) for significant drift.
      // We use a loose comparison to allow minor formatting differences (e.g. "JOHN DOE" vs "John Doe").
      const storedName = (accountName || "").toLowerCase().trim();
      const verifiedName = verifyResult.accountName.toLowerCase().trim();
      if (storedName && verifiedName && storedName !== verifiedName) {
        logger.warn(
          { tenantId, storedName, verifiedName, bankCode, accountNumber },
          "Settlement account name mismatch detected during pre-withdrawal verification"
        );
        // Update the stored account name to the latest verified name
        const tenantRecord = await Tenant.findById(tenantId);
        if (tenantRecord && tenantRecord.settlementAccount) {
          tenantRecord.settlementAccount.accountName = verifyResult.accountName;
          await tenantRecord.save();
          logger.info({ tenantId }, "Updated settlement account name to verified value");
        }
      }
    } catch (verifyError) {
      // If the verification itself fails (network error, etc.), we still allow
      // the withdrawal to proceed — the Nomba transfer will catch invalid accounts.
      // Only block on explicit "could not resolve" errors thrown above.
      if (verifyError instanceof Error && verifyError.message.includes("Could not resolve")) {
        throw verifyError;
      }
      logger.warn(
        { tenantId, error: verifyError instanceof Error ? verifyError.message : "Unknown" },
        "Pre-withdrawal bank verification failed (non-blocking) — proceeding with withdrawal"
      );
    }

    // Generate a unique reference
    const merchantTxRef = `wd_${tenantId}_${Date.now()}`;

    try {
      // Attempt the real-world transfer via Nomba
      const transferResponse = await nombaService.transferToBank({
        amount,
        bankCode,
        accountNumber,
        accountName,
        merchantTxRef,
        senderName: "FlexCharge Payout",
        narration: "FlexCharge Payout",
      });

      if (transferResponse.status !== "SUCCESS" && transferResponse.status !== "PENDING") {
        throw new Error(`Nomba transfer failed with status: ${transferResponse.status}`);
      }

      // Deduct balance
      ledger.availableBalance -= amount;
      ledger.totalWithdrawn += amount;
      await ledger.save();

      // Log transaction
      await LedgerTransaction.create({
        tenantId,
        type: "DEBIT",
        amount,
        description: `Withdrawal to ${accountName} (${accountNumber})`,
        referenceId: transferResponse.transferId,
        status: transferResponse.status === "PENDING" ? "PENDING" : "SUCCESS",
      });

      // Queue email
      await queueEmail("tenant", "withdrawal_successful", { tenantId, failureReason: amount.toString() });

      logger.info({ tenantId, amount, merchantTxRef }, "Withdrawal processed successfully");
    } catch (error) {
      logger.error({ tenantId, amount, error }, "Withdrawal failed");
      
      // Queue failure email
      await queueEmail("tenant", "withdrawal_failed", { 
        tenantId, 
        failureReason: error instanceof Error ? error.message : "Unknown error" 
      });

      throw error;
    }
  }

  /**
   * Process a refund to a customer and debit the tenant's ledger.
   *
   * @param tenantId - The tenant's ID
   * @param invoiceId - The ID of the invoice being refunded
   * @param customerBankDetails - { accountNumber, bankCode } required by Nomba
   * @param amount - The amount to refund in KOBO
   */
  async processRefund(
    tenantId: Types.ObjectId | string,
    invoiceId: string,
    nombaTransactionId: string,
    amount: number,
    customerBankDetails?: { accountNumber?: string; bankCode?: string }
  ): Promise<void> {
    const ledger = await TenantLedger.findOne({ tenantId });
    if (!ledger) throw new Error("Ledger not found");

    if (ledger.availableBalance < amount) {
      throw new Error("Insufficient ledger balance to process refund");
    }

    try {
      // Initiate Nomba Refund API
      const refundResponse = await nombaService.refundCheckoutOrder({
        transactionId: nombaTransactionId,
        amount,
        accountNumber: customerBankDetails?.accountNumber,
        bankCode: customerBankDetails?.bankCode,
      });

      if (refundResponse.status !== "SUCCESS") {
        throw new Error(`Nomba refund failed with status: ${refundResponse.status}`);
      }

      // Deduct balance
      ledger.availableBalance -= amount;
      await ledger.save();

      // Log transaction
      await LedgerTransaction.create({
        tenantId,
        type: "DEBIT",
        amount,
        description: `Refund for Invoice ${invoiceId}`,
        referenceId: nombaTransactionId,
        status: "SUCCESS",
      });

      // Queue emails
      // Note: We use invoiceId in context to allow email jobs to look up the customer details
      await queueEmail("customer", "refund_processed", { tenantId, invoiceId });
      await queueEmail("tenant", "refund_deducted", { tenantId, invoiceId });

      logger.info({ tenantId, invoiceId, amount }, "Refund processed successfully");
    } catch (error) {
      logger.error({ tenantId, invoiceId, amount, error }, "Refund failed");
      throw error;
    }
  }
}

export const ledgerService = new LedgerService();
