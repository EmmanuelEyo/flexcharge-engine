import test from "node:test";
import assert from "node:assert";
import mongoose, { Types } from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { TenantLedger } from "../models/TenantLedger.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { ledgerService } from "../services/ledger.service.js";
import { nombaService } from "../services/nomba.service.js";

const originalTransfer = nombaService.transferToBank;
const originalRefund = nombaService.refundCheckoutOrder;

test("Ledger Service", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    nombaService.transferToBank = originalTransfer;
    nombaService.refundCheckoutOrder = originalRefund;
  });

  t.after(async () => {
    nombaService.transferToBank = originalTransfer;
    nombaService.refundCheckoutOrder = originalRefund;
    await teardownTestDB();
  });

  await t.test("creditTenant successfully increments balance and logs transaction", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
    });

    await ledgerService.creditTenant(tenant._id.toString(), 5000, "inv_123");

    const ledger = await TenantLedger.findOne({ tenantId: tenant._id });
    assert.ok(ledger);
    assert.strictEqual(ledger.availableBalance, 5000);
    assert.strictEqual(ledger.totalWithdrawn, 0);

    const tx = await LedgerTransaction.findOne({ tenantId: tenant._id });
    assert.ok(tx);
    assert.strictEqual(tx.type, "CREDIT");
    assert.strictEqual(tx.amount, 5000);
    assert.strictEqual(tx.referenceId, "inv_123");
    assert.strictEqual(tx.status, "SUCCESS");
  });

  await t.test("processWithdrawal fails if tenant has no bank account", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test2@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
    });

    await assert.rejects(
      ledgerService.processWithdrawal(tenant._id.toString(), 1000),
      /configured settlement bank account/
    );
  });

  await t.test("processWithdrawal fails if balance is insufficient", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test3@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
      settlementAccount: { bankCode: "058", accountNumber: "1234567890", accountName: "Test" },
    });

    await TenantLedger.create({ tenantId: tenant._id, availableBalance: 500 });

    await assert.rejects(
      ledgerService.processWithdrawal(tenant._id.toString(), 1000),
      /Insufficient ledger balance/
    );
  });

  await t.test("processWithdrawal succeeds with sufficient balance", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test4@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
      settlementAccount: { bankCode: "058", accountNumber: "1234567890", accountName: "Test" },
    });

    await TenantLedger.create({ tenantId: tenant._id, availableBalance: 5000 });

    // Mock nomba transfer
    nombaService.transferToBank = async () => ({ status: "SUCCESS", transferId: "tx_123" });

    await ledgerService.processWithdrawal(tenant._id.toString(), 1000);

    const ledger = await TenantLedger.findOne({ tenantId: tenant._id });
    assert.strictEqual(ledger!.availableBalance, 4000);
    assert.strictEqual(ledger!.totalWithdrawn, 1000);

    const tx = await LedgerTransaction.findOne({ tenantId: tenant._id });
    assert.strictEqual(tx!.type, "DEBIT");
    assert.strictEqual(tx!.amount, 1000);
    assert.strictEqual(tx!.referenceId, "tx_123");
  });

  await t.test("processRefund fails if balance is insufficient", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test5@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
    });

    await TenantLedger.create({ tenantId: tenant._id, availableBalance: 500 });

    await assert.rejects(
      ledgerService.processRefund(tenant._id.toString(), "inv_123", "nomba_123", 1000, { accountNumber: "1", bankCode: "2" }),
      /Insufficient ledger balance/
    );
  });

  await t.test("processRefund succeeds with sufficient balance", async () => {
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test6@example.com",
      passwordHash: "hash",
      webhookSecret: "secret",
    });

    await TenantLedger.create({ tenantId: tenant._id, availableBalance: 5000 });

    // Mock nomba refund
    nombaService.refundCheckoutOrder = async () => ({ status: "SUCCESS" });

    await ledgerService.processRefund(tenant._id.toString(), "inv_123", "nomba_123", 1000);

    const ledger = await TenantLedger.findOne({ tenantId: tenant._id });
    assert.strictEqual(ledger!.availableBalance, 4000);

    const tx = await LedgerTransaction.findOne({ tenantId: tenant._id });
    assert.strictEqual(tx!.type, "DEBIT");
    assert.strictEqual(tx!.amount, 1000);
    assert.strictEqual(tx!.referenceId, "nomba_123");
    assert.ok(tx!.description.includes("Refund"));
  });
});
