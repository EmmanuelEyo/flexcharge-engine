import test from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { DunningAttempt } from "../models/DunningAttempt.js";
import {
  calculateNextPayday,
  calculateNextRetryDate,
  processDunningRetry,
} from "../services/dunning.service.js";
import { nombaService } from "../services/nomba.service.js";
import { ledgerService } from "../services/ledger.service.js";

const originalChargeTokenizedCard = nombaService.chargeTokenizedCard;
const originalCreditTenant = ledgerService.creditTenant;

async function seedDunningFixture() {
  const tenant = await Tenant.create({
    name: "Dunning Tenant",
    email: `dunning-${Date.now()}@example.com`,
    passwordHash: "hashed-password",
    webhookSecret: "dunning-secret",
  });

  const customer = await Customer.create({
    tenantId: tenant._id,
    email: `dunning-customer-${Date.now()}@example.com`,
    name: "Dunning Customer",
  });

  const plan = await Plan.create({
    tenantId: tenant._id,
    name: "Pro Monthly",
    slug: `pro-monthly-dunning-${Date.now()}`,
    amount: 500000,
    currency: "NGN",
    interval: "monthly",
    features: ["Dunning"],
  });

  const currentPeriodEnd = new Date("2026-07-01T00:00:00.000Z");

  const subscription = await Subscription.create({
    tenantId: tenant._id,
    customerId: customer._id,
    planId: plan._id,
    status: "past_due",
    tokenKey: "tok_dunning_123",
    cardLast4: "4242",
    cardBrand: "VISA",
    currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
    currentPeriodEnd,
    nextBillingDate: currentPeriodEnd,
    dunningAttemptCount: 1,
  });

  const invoice = await Invoice.create({
    tenantId: tenant._id,
    subscriptionId: subscription._id,
    customerId: customer._id,
    amount: plan.amount,
    currency: "NGN",
    status: "pending",
    nombaOrderReference: `inv_${subscription._id}`,
    description: "Dunning test invoice",
    isRenewal: true,
  });

  const attempt = await DunningAttempt.create({
    tenantId: tenant._id,
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    attemptNumber: 1,
    scheduledFor: new Date(),
    status: "scheduled",
    nextRetryAt: new Date(),
  });

  return { tenant, customer, plan, subscription, invoice, attempt };
}

test("Dunning Service", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    ledgerService.creditTenant = async () => {};
  });

  t.after(async () => {
    nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    ledgerService.creditTenant = originalCreditTenant;
    await teardownTestDB();
  });

  await t.test("calculates retry timing for soft and hard declines", () => {
    console.log("[DUNNING][TEST] evaluating retry timing");

    const paydayRetry = calculateNextRetryDate(1, "51");
    const hardDeclineRetry = calculateNextRetryDate(1, "54");
    const exhaustedRetry = calculateNextRetryDate(5, "51");

    assert.ok(paydayRetry);
    assert.ok(paydayRetry.getTime() > Date.now());
    assert.ok([1, 15].includes(paydayRetry.getDate()));
    assert.strictEqual(paydayRetry.getHours(), 9);
    assert.strictEqual(paydayRetry.getMinutes(), 0);
    assert.strictEqual(hardDeclineRetry, null);
    assert.strictEqual(exhaustedRetry, null);
  });

  await t.test("recovers a subscription when the retry succeeds", async () => {
    console.log("[DUNNING][TEST] processing successful retry");

    const { subscription, invoice, attempt, plan } = await seedDunningFixture();

    nombaService.chargeTokenizedCard = (async () => ({
      success: true,
      message: "success",
      transactionId: "txn_recovery_123",
    })) as any;

    try {
      const result = await processDunningRetry(attempt._id as Types.ObjectId);

      if (!result.success) {
        console.error("PROCESS DUNNING FAILED:", result);
      }
      assert.strictEqual(result.success, true);

      const updatedAttempt = await DunningAttempt.findById(attempt._id);
      const updatedInvoice = await Invoice.findById(invoice._id);
      const updatedSubscription = await Subscription.findById(subscription._id);

      assert.ok(updatedAttempt);
      assert.strictEqual(updatedAttempt?.status, "succeeded");
      assert.ok(updatedAttempt?.executedAt);
      assert.ok(updatedInvoice);
      assert.strictEqual(updatedInvoice?.status, "paid");
      assert.strictEqual(updatedInvoice?.nombaTransactionId, `retry_${invoice._id}_${attempt.attemptNumber}`);
      assert.ok(updatedSubscription);
      assert.strictEqual(updatedSubscription?.status, "active");
      assert.strictEqual(updatedSubscription?.dunningAttemptCount, 0);
      assert.strictEqual(
        updatedSubscription?.currentPeriodEnd?.toISOString(),
        new Date("2026-07-31T00:00:00.000Z").toISOString()
      );
      assert.strictEqual(
        updatedSubscription?.nextBillingDate?.toISOString(),
        new Date("2026-07-31T00:00:00.000Z").toISOString()
      );
      assert.strictEqual(plan.interval, "monthly");
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });

  await t.test("schedules a payday-aligned retry for insufficient funds", async () => {
    console.log("[DUNNING][TEST] processing soft decline retry");

    const { subscription, invoice, attempt } = await seedDunningFixture();

    nombaService.chargeTokenizedCard = (async () => ({
      success: false,
      declineCode: "51",
      message: "Insufficient funds",
    })) as any;

    try {
      const result = await processDunningRetry(attempt._id as Types.ObjectId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Insufficient funds");

      const nextAttempt = await DunningAttempt.findOne({
        subscriptionId: subscription._id,
        attemptNumber: 2,
      });
      const updatedSubscription = await Subscription.findById(subscription._id);

      assert.ok(nextAttempt);
      assert.strictEqual(nextAttempt?.status, "scheduled");
      assert.ok(updatedSubscription);
      assert.strictEqual(updatedSubscription?.status, "past_due");
      assert.strictEqual(updatedSubscription?.dunningAttemptCount, 1);
      const payday = calculateNextPayday();
      assert.strictEqual(nextAttempt?.scheduledFor.getDate(), payday.getDate());
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });
});
