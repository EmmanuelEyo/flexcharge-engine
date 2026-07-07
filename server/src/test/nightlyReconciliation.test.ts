import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Wallet } from "../models/Wallet.js";
import { Invoice } from "../models/Invoice.js";
import { TenantLedger } from "../models/TenantLedger.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { EmailOutbox } from "../models/EmailOutbox.js";
import { repairMissedWalletAutoTopups } from "../jobs/nightlyReconciliation.js";
import { nombaService } from "../services/nomba.service.js";
import { ledgerService } from "../services/ledger.service.js";
import { env } from "../config/environment.js";

const originalFetchCheckoutTransaction = nombaService.fetchCheckoutTransaction;
const originalResendApiKey = env.RESEND_API_KEY;
const originalStartSession = mongoose.startSession;
const originalWalletFindOneAndUpdate = Wallet.findOneAndUpdate;
const originalWalletTransactionCreate = WalletTransaction.create;
const originalLedgerCreditTenant = ledgerService.creditTenant;

test("Nightly Reconciliation Wallet Auto Top-Up Repair", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    (nombaService as any).fetchCheckoutTransaction = originalFetchCheckoutTransaction;
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalWalletFindOneAndUpdate;
    WalletTransaction.create = originalWalletTransactionCreate;
    (ledgerService as any).creditTenant = originalLedgerCreditTenant;
    env.RESEND_API_KEY = originalResendApiKey;
  });

  t.after(async () => {
    (nombaService as any).fetchCheckoutTransaction = originalFetchCheckoutTransaction;
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalWalletFindOneAndUpdate;
    WalletTransaction.create = originalWalletTransactionCreate;
    (ledgerService as any).creditTenant = originalLedgerCreditTenant;
    env.RESEND_API_KEY = originalResendApiKey;
    await teardownTestDB();
  });

  await t.test("repairs a missed wallet auto top-up exactly once", async () => {
    env.RESEND_API_KEY = "test-resend-key";

    const tenant = await Tenant.create({
      name: "Repair Tenant",
      email: `repair-${Date.now()}@example.com`,
      passwordHash: "hashed-password",
      webhookSecret: "repair-secret",
    });

    const customer = await Customer.create({
      tenantId: tenant._id,
      email: `repair-customer-${Date.now()}@example.com`,
      name: "Repair Customer",
      paymentMethods: [
        {
          methodType: "card",
          isDefault: true,
          tokenKey: "tok_repair_success",
          cardLast4: "4242",
          cardBrand: "Visa",
        },
      ],
    });

    const wallet = await Wallet.create({
      tenantId: tenant._id,
      customerId: customer._id,
      balance: 0,
      currency: "NGN",
      lowBalanceThreshold: 5000,
      autoTopUp: true,
      autoTopUpAmount: 10000,
      autoTopUpTrigger: 5000,
      isActive: true,
    });

    mongoose.startSession = (async () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: () => undefined,
    })) as any;

    Wallet.findOneAndUpdate = (async (_filter: any, update: any) => {
      const walletDoc = await Wallet.findById(wallet._id);
      if (!walletDoc) return null;
      const delta = update?.$inc?.balance ?? 0;
      walletDoc.balance += delta;
      await walletDoc.save();
      return walletDoc;
    }) as any;

    WalletTransaction.create = (async (docs: any, _options?: any) => {
      return originalWalletTransactionCreate.call(WalletTransaction, docs);
    }) as any;

    (ledgerService as any).creditTenant = async (tenantId: any, amount: number, invoiceId: string) => {
      let ledger = await TenantLedger.findOne({ tenantId });
      if (!ledger) {
        ledger = await TenantLedger.create({ tenantId, availableBalance: 0, totalWithdrawn: 0 });
      }

      ledger.availableBalance += amount;
      await ledger.save();

      await LedgerTransaction.create({
        tenantId,
        type: "CREDIT",
        amount,
        description: `Payment received for Invoice ${invoiceId}`,
        referenceId: invoiceId,
        status: "SUCCESS",
      });
    };

    const invoice = await Invoice.create({
      tenantId: tenant._id,
      customerId: customer._id,
      amount: 10000,
      currency: "NGN",
      status: "failed",
      nombaOrderReference: `topup_${wallet._id}_1720000000000`,
      description: "Wallet Auto Top-Up",
      isRenewal: false,
      failureReason: "Charge was misclassified as failed",
    });

    (nombaService as any).fetchCheckoutTransaction = async () => ({
      success: true,
      message: "Approved",
      order: {
        orderId: "order_123",
        orderReference: invoice.nombaOrderReference,
        customerId: customer._id.toString(),
        accountId: "account_123",
        callbackUrl: "https://example.com/billing/complete",
        customerEmail: customer.email,
        amount: "100.00",
        currency: "NGN",
      },
      transactionDetails: {
        transactionDate: new Date().toISOString(),
        paymentReference: "pay_123",
        paymentVendorReference: "vendor_123",
        tokenizedCardPayment: true,
        statusCode: "Payment approved",
      },
    });

    const firstResult = await repairMissedWalletAutoTopups();
    assert.strictEqual(firstResult.examined, 1);
    assert.strictEqual(firstResult.repaired, 1);

    const walletAfterFirst = await Wallet.findById(wallet._id);
    const invoiceAfterFirst = await Invoice.findById(invoice._id);
    const ledgerAfterFirst = await TenantLedger.findOne({ tenantId: tenant._id });
    const walletTxCountAfterFirst = await WalletTransaction.countDocuments({
      referenceId: invoice._id.toString(),
      type: "credit",
    });
    const ledgerTxCountAfterFirst = await LedgerTransaction.countDocuments({
      referenceId: invoice._id.toString(),
      type: "CREDIT",
    });
    const emailCountAfterFirst = await EmailOutbox.countDocuments({
      tenantId: tenant._id,
      customerId: customer._id,
      type: "wallet_topped_up",
    });

    assert.strictEqual(walletAfterFirst?.balance, 10000);
    assert.strictEqual(invoiceAfterFirst?.status, "paid");
    assert.strictEqual(ledgerAfterFirst?.availableBalance, 10000);
    assert.strictEqual(walletTxCountAfterFirst, 1);
    assert.strictEqual(ledgerTxCountAfterFirst, 1);
    assert.strictEqual(emailCountAfterFirst, 1);

    const secondResult = await repairMissedWalletAutoTopups();
    assert.strictEqual(secondResult.examined, 0);
    assert.strictEqual(secondResult.repaired, 0);

    const walletAfterSecond = await Wallet.findById(wallet._id);
    const ledgerAfterSecond = await TenantLedger.findOne({ tenantId: tenant._id });
    const walletTxCountAfterSecond = await WalletTransaction.countDocuments({
      referenceId: invoice._id.toString(),
      type: "credit",
    });
    const ledgerTxCountAfterSecond = await LedgerTransaction.countDocuments({
      referenceId: invoice._id.toString(),
      type: "CREDIT",
    });
    const emailCountAfterSecond = await EmailOutbox.countDocuments({
      tenantId: tenant._id,
      customerId: customer._id,
      type: "wallet_topped_up",
    });

    assert.strictEqual(walletAfterSecond?.balance, 10000);
    assert.strictEqual(ledgerAfterSecond?.availableBalance, 10000);
    assert.strictEqual(walletTxCountAfterSecond, 1);
    assert.strictEqual(ledgerTxCountAfterSecond, 1);
    assert.strictEqual(emailCountAfterSecond, 1);
  });
});
