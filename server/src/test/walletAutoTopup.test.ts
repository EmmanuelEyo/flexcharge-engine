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
import { defineWalletAutoTopupJob } from "../jobs/walletAutoTopup.js";
import { nombaService } from "../services/nomba.service.js";
import { ledgerService } from "../services/ledger.service.js";
import { env } from "../config/environment.js";

const originalChargeTokenizedCard = nombaService.chargeTokenizedCard;
const originalResendApiKey = env.RESEND_API_KEY;
const originalStartSession = mongoose.startSession;
const originalWalletFindOneAndUpdate = Wallet.findOneAndUpdate;
const originalWalletTransactionCreate = WalletTransaction.create;
const originalLedgerCreditTenant = ledgerService.creditTenant;

test("Wallet Auto Top-Up Job", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    (nombaService as any).chargeTokenizedCard = originalChargeTokenizedCard;
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalWalletFindOneAndUpdate;
    WalletTransaction.create = originalWalletTransactionCreate;
    (ledgerService as any).creditTenant = originalLedgerCreditTenant;
    env.RESEND_API_KEY = originalResendApiKey;
  });

  t.after(async () => {
    (nombaService as any).chargeTokenizedCard = originalChargeTokenizedCard;
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalWalletFindOneAndUpdate;
    WalletTransaction.create = originalWalletTransactionCreate;
    (ledgerService as any).creditTenant = originalLedgerCreditTenant;
    env.RESEND_API_KEY = originalResendApiKey;
    await teardownTestDB();
  });

  await t.test("credits the wallet, ledger, invoice, and email queue after a successful charge", async () => {
    env.RESEND_API_KEY = "test-resend-key";

    const tenant = await Tenant.create({
      name: "Auto Top-Up Tenant",
      email: `autotopup-${Date.now()}@example.com`,
      passwordHash: "hashed-password",
      webhookSecret: "wallet-secret",
    });

    const customer = await Customer.create({
      tenantId: tenant._id,
      email: `wallet-customer-${Date.now()}@example.com`,
      name: "Wallet Customer",
      paymentMethods: [
        {
          methodType: "card",
          isDefault: true,
          tokenKey: "tok_wallet_success",
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

    (nombaService as any).chargeTokenizedCard = async () => ({
      success: true,
      requiresOTP: false,
      message: "Approved",
    });

    let capturedJob: ((job: unknown) => Promise<void>) | undefined;
    defineWalletAutoTopupJob({
      define: (_name: string, handler: (job: unknown) => Promise<void>) => {
        capturedJob = handler;
      },
    } as any);

    assert.ok(capturedJob, "wallet auto top-up job handler was not registered");
    await capturedJob!({} as any);

    const updatedWallet = await Wallet.findById(wallet._id);
    const invoice = await Invoice.findOne({
      tenantId: tenant._id,
      customerId: customer._id,
      description: "Wallet Auto Top-Up",
    });
    const ledger = await TenantLedger.findOne({ tenantId: tenant._id });

    assert.ok(invoice, "expected wallet auto top-up invoice to be created");
    const invoiceDoc = invoice as NonNullable<typeof invoice>;
    const invoiceId = invoiceDoc._id.toString();
    const walletTransaction = await WalletTransaction.findOne({
      referenceId: invoiceId,
      type: "credit",
    });
    const email = await EmailOutbox.findOne({
      tenantId: tenant._id,
      customerId: customer._id,
      type: "wallet_topped_up",
    });

    assert.strictEqual(invoiceDoc.status, "paid");
    assert.strictEqual(updatedWallet?.balance, 10000);
    assert.strictEqual(ledger?.availableBalance, 10000);
    assert.ok(walletTransaction, "expected wallet credit transaction to be recorded");
    assert.ok(email, "expected wallet topped up email to be queued");
  });
});
