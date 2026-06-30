import test from "node:test";
import assert from "node:assert";
import mongoose, { Types } from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Wallet } from "../models/Wallet.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import {
  createWallet,
  creditWallet,
  debitWallet,
} from "../services/wallet.service.js";

const originalStartSession = mongoose.startSession;
const originalFindOneAndUpdate = Wallet.findOneAndUpdate;
const originalFindById = Wallet.findById;
const originalTransactionCreate = WalletTransaction.create;

function makeQueryableDoc<T extends Record<string, any>>(doc: T): any {
  return {
    session: async () => doc,
    then: (resolve: any, reject: any) => Promise.resolve(doc).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(doc).catch(reject),
  };
}

test("Wallet Service", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalFindOneAndUpdate;
    Wallet.findById = originalFindById;
    WalletTransaction.create = originalTransactionCreate;
  });

  t.after(async () => {
    mongoose.startSession = originalStartSession;
    Wallet.findOneAndUpdate = originalFindOneAndUpdate;
    Wallet.findById = originalFindById;
    WalletTransaction.create = originalTransactionCreate;
    await teardownTestDB();
  });

  await t.test("creates a wallet once per tenant/customer pair", async () => {
    console.log("[WALLET][TEST] creating wallet record");

    const tenant = await Tenant.create({
      name: "Wallet Tenant",
      email: `wallet-${Date.now()}@example.com`,
      passwordHash: "hashed-password",
      webhookSecret: "wallet-secret",
    });
    const customer = await Customer.create({
      tenantId: tenant._id,
      email: `wallet-customer-${Date.now()}@example.com`,
      name: "Wallet Customer",
    });

    const created = await createWallet(tenant._id as Types.ObjectId, customer._id as Types.ObjectId);
    const reused = await createWallet(tenant._id as Types.ObjectId, customer._id as Types.ObjectId);

    assert.strictEqual(created.balance, 0);
    assert.strictEqual(created._id.toString(), reused._id.toString());
  });

  await t.test("credits and debits balances using integer kobo values", async () => {
    console.log("[WALLET][TEST] exercising atomic balance changes");

    const walletId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const state = {
      _id: walletId,
      tenantId,
      customerId,
      balance: 100000,
      currency: "NGN",
      lowBalanceThreshold: 50000,
    };

    mongoose.startSession = (async () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: () => undefined,
    })) as any;

    Wallet.findOneAndUpdate = (async (_filter: any, update: any) => {
      const delta = update?.$inc?.balance ?? 0;
      state.balance += delta;
      return { ...state };
    }) as any;

    Wallet.findById = ((id: Types.ObjectId) => makeQueryableDoc(state)) as any;

    WalletTransaction.create = (async () => [
      { _id: new Types.ObjectId() },
    ]) as any;

    const credit = await creditWallet(walletId, 25000, "Top up", "ref_credit");
    assert.strictEqual(credit.balanceBefore, 100000);
    assert.strictEqual(credit.balanceAfter, 125000);

    const debit = await debitWallet(walletId, 80000, "Usage", "ref_debit");
    assert.strictEqual(debit.balanceBefore, 125000);
    assert.strictEqual(debit.balanceAfter, 45000);
  });

  await t.test("rejects debits that would create a negative balance", async () => {
    console.log("[WALLET][TEST] validating insufficient balance protection");

    const walletId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const state = {
      _id: walletId,
      tenantId,
      customerId,
      balance: 10000,
      currency: "NGN",
      lowBalanceThreshold: 5000,
    };

    mongoose.startSession = (async () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: () => undefined,
    })) as any;

    Wallet.findById = ((id: Types.ObjectId) => makeQueryableDoc(state)) as any;
    Wallet.findOneAndUpdate = (async () => {
      throw new Error("Should not update when balance is insufficient");
    }) as any;

    let caught: any;
    try {
      await debitWallet(walletId, 50000, "Usage", "ref_negative");
    } catch (error) {
      caught = error;
    }

    assert.ok(caught);
    assert.strictEqual(caught.message, "Insufficient wallet balance");
  });
});
