import test from "node:test";
import assert from "node:assert";
import mongoose, { Types } from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { DunningAttempt } from "../models/DunningAttempt.js";
import {
  calculateNextBillingDate,
  findDueSubscriptions,
  processRenewal,
  sendUpcomingRenewalReminders,
} from "../services/billing.service.js";
import { nombaService } from "../services/nomba.service.js";
import { ledgerService } from "../services/ledger.service.js";
import React from "react";
import { renderToString } from "react-dom/server";
import { WelcomeEmail } from "../emails/customer/WelcomeEmail.js";

const originalChargeTokenizedCard = nombaService.chargeTokenizedCard;
const originalCreateCheckoutOrder = nombaService.createCheckoutOrder;
const originalCreditTenant = ledgerService.creditTenant;

async function seedRenewalFixture() {
  const tenant = await Tenant.create({
    name: "Billing Tenant",
    email: `billing-${Date.now()}@example.com`,
    passwordHash: "hashed-password",
    webhookSecret: "billing-secret",
  });

  const customer = await Customer.create({
    tenantId: tenant._id,
    email: `customer-${Date.now()}@example.com`,
    name: "Billing Customer",
  });

  const plan = await Plan.create({
    tenantId: tenant._id,
    name: "Pro Monthly",
    slug: `pro-monthly-${Date.now()}`,
    amount: 500000,
    currency: "NGN",
    interval: "monthly",
    features: ["Billing"],
  });

  const currentPeriodStart = new Date("2026-06-01T00:00:00.000Z");
  const currentPeriodEnd = new Date("2026-07-01T00:00:00.000Z");

  const subscription = await Subscription.create({
    tenantId: tenant._id,
    customerId: customer._id,
    planId: plan._id,
    status: "active",
    tokenKey: "tok_billing_123",
    cardLast4: "4242",
    cardBrand: "VISA",
    currentPeriodStart,
    currentPeriodEnd,
    nextBillingDate: currentPeriodEnd,
    dunningAttemptCount: 0,
  });

  return { tenant, customer, plan, subscription, currentPeriodStart, currentPeriodEnd };
}

test("Billing Service", async (t) => {
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

  await t.test("calculates the next billing date for common intervals", () => {
    console.log("[BILLING][TEST] calculating next billing dates");

    const baseDate = new Date("2026-07-01T00:00:00.000Z");

    assert.strictEqual(
      calculateNextBillingDate(baseDate, "monthly").toISOString(),
      "2026-07-31T00:00:00.000Z"
    );
    assert.strictEqual(
      calculateNextBillingDate(baseDate, "yearly").toISOString(),
      "2027-07-01T00:00:00.000Z"
    );
  });

  await t.test("finds only due active subscriptions", async () => {
    console.log("[BILLING][TEST] locating due subscriptions");

    const { tenant, customer, plan, subscription } = await seedRenewalFixture();

    subscription.nextBillingDate = new Date(Date.now() - 60 * 1000);
    await subscription.save();

    await Subscription.create({
      tenantId: tenant._id,
      customerId: customer._id,
      planId: plan._id,
      status: "active",
      tokenKey: "tok_future",
      currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      nextBillingDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await Subscription.create({
      tenantId: tenant._id,
      customerId: customer._id,
      planId: plan._id,
      status: "canceled",
      tokenKey: "tok_cancelled",
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      nextBillingDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const due = await findDueSubscriptions();

    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0]!._id.toString(), subscription._id.toString());
    assert.strictEqual((due[0]!.planId as any).name, "Pro Monthly");
    assert.strictEqual((due[0]!.customerId as any).email, customer.email);
  });

  await t.test("does not include cancel-at-period-end subscriptions in due scans", async () => {
    console.log("[BILLING][TEST] excluding scheduled cancellations from renewal scans");

    const { subscription } = await seedRenewalFixture();
    subscription.nextBillingDate = new Date(Date.now() - 60 * 1000);
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    const due = await findDueSubscriptions();

    assert.strictEqual(due.length, 0);
  });

  await t.test("processes a successful renewal and advances the billing cycle", async () => {
    console.log("[BILLING][TEST] processing renewal success path");

    const { subscription, plan, currentPeriodEnd } = await seedRenewalFixture();
    const chargeCalls: any[] = [];

    nombaService.chargeTokenizedCard = (async (params: any) => {
      chargeCalls.push(params);
      return {
        success: true,
        message: "success",
        transactionId: "txn_success_123",
      };
    }) as any;

    try {
      const result = await processRenewal(subscription._id as Types.ObjectId);

      if (!result.success) {
        console.error("PROCESS RENEWAL FAILED:", result);
      }
      assert.strictEqual(result.success, true);
      assert.ok(result.invoiceId);
      assert.strictEqual(chargeCalls.length, 1);

      const invoice = await Invoice.findById(result.invoiceId);
      assert.ok(invoice);
      assert.strictEqual(invoice?.status, "paid");
      assert.strictEqual(invoice?.nombaTransactionId, invoice?.nombaOrderReference);

      const updated = await Subscription.findById(subscription._id);
      assert.ok(updated);
      assert.strictEqual(updated?.status, "active");
      assert.strictEqual(updated?.dunningAttemptCount, 0);
      assert.strictEqual(
        updated?.currentPeriodStart?.toISOString(),
        currentPeriodEnd.toISOString()
      );
      assert.strictEqual(
        updated?.currentPeriodEnd?.toISOString(),
        calculateNextBillingDate(currentPeriodEnd, plan.interval).toISOString()
      );
      assert.strictEqual(
        updated?.nextBillingDate?.toISOString(),
        calculateNextBillingDate(currentPeriodEnd, plan.interval).toISOString()
      );
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });

  await t.test("skips renewal when the subscription is scheduled to cancel at period end", async () => {
    console.log("[BILLING][TEST] refusing renewal for scheduled cancellations");

    const { subscription } = await seedRenewalFixture();
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    let chargeCount = 0;
    nombaService.chargeTokenizedCard = (async () => {
      chargeCount += 1;
      return {
        success: true,
        message: "should not be called",
        transactionId: "txn_should_not_run",
      };
    }) as any;

    try {
      const result = await processRenewal(subscription._id as Types.ObjectId);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("scheduled to cancel at period end"));
      assert.strictEqual(chargeCount, 0);

      const invoices = await Invoice.find({ subscriptionId: subscription._id });
      assert.strictEqual(invoices.length, 0);
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });

  await t.test("skips duplicate renewal attempts using the invoice idempotency key", async () => {
    console.log("[BILLING][TEST] checking renewal idempotency");

    const { subscription, currentPeriodEnd } = await seedRenewalFixture();
    const idempotencyKey = `bill_${subscription._id}_${currentPeriodEnd.toISOString().split("T")[0]}`;

    await Invoice.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription._id,
      customerId: subscription.customerId,
      amount: 500000,
      currency: "NGN",
      status: "paid",
      nombaOrderReference: `existing_${subscription._id}`,
      description: "Existing billed invoice",
      isRenewal: true,
      idempotencyKey,
    });

    let chargeCount = 0;
    nombaService.chargeTokenizedCard = (async () => {
      chargeCount += 1;
      return { success: true, message: "success", transactionId: "txn_should_not_run" };
    }) as any;

    try {
      const result = await processRenewal(subscription._id as Types.ObjectId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Already billed for this period");
      assert.strictEqual(chargeCount, 0);

      const invoices = await Invoice.find({ subscriptionId: subscription._id });
      assert.strictEqual(invoices.length, 1);
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });

  await t.test("moves failed renewals into dunning", async () => {
    console.log("[BILLING][TEST] processing renewal failure path");

    const { subscription } = await seedRenewalFixture();

    nombaService.chargeTokenizedCard = (async () => ({
      success: false,
      declineCode: "51",
      message: "Insufficient funds",
    })) as any;

    try {
      const result = await processRenewal(subscription._id as Types.ObjectId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Insufficient funds");

      const updated = await Subscription.findById(subscription._id);
      const invoice = await Invoice.findOne({ subscriptionId: subscription._id });
      const attempt = await DunningAttempt.findOne({ subscriptionId: subscription._id });

      assert.ok(updated);
      assert.strictEqual(updated?.status, "past_due");
      assert.strictEqual(updated?.dunningAttemptCount, 1);
      assert.ok(invoice);
      assert.strictEqual(invoice?.status, "failed");
      assert.ok(attempt);
      assert.strictEqual(attempt?.attemptNumber, 1);
      assert.strictEqual(attempt?.status, "scheduled");
      assert.ok(attempt?.nextRetryAt);
    } finally {
      nombaService.chargeTokenizedCard = originalChargeTokenizedCard;
    }
  });

  await t.test("sends upcoming renewal reminders for manual subscriptions", async () => {
    console.log("[BILLING][TEST] scanning upcoming manual renewal reminders");

    const { tenant, customer, plan, subscription } = await seedRenewalFixture();

    // Set subscription to manual renewal with next billing date in 2 days (within 3 days window)
    subscription.renewalMode = "manual";
    subscription.tokenKey = undefined;
    subscription.nextBillingDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await subscription.save();

    // Mock createCheckoutOrder
    let createCheckoutCalls = 0;
    const originalCreateCheckoutOrder = nombaService.createCheckoutOrder;
    nombaService.createCheckoutOrder = (async (params: any) => {
      createCheckoutCalls += 1;
      return {
        orderReference: params.orderReference,
        checkoutLink: "https://pay.nomba.com/checkout/mocked",
      };
    }) as any;

    try {
      // 1. Run the reminder scan
      const count = await sendUpcomingRenewalReminders(3);
      assert.strictEqual(count, 1);
      assert.strictEqual(createCheckoutCalls, 1);

      // Verify a pending invoice was created
      const invoice = await Invoice.findOne({ subscriptionId: subscription._id });
      assert.ok(invoice);
      assert.strictEqual(invoice.status, "pending");
      assert.strictEqual(invoice.checkoutLink, "https://pay.nomba.com/checkout/mocked");
      assert.ok(invoice.nombaOrderReference);

      // 2. Running the scan again should skip it (idempotency key prevents duplicate)
      const countSecondRun = await sendUpcomingRenewalReminders(3);
      assert.strictEqual(countSecondRun, 0);
      assert.strictEqual(createCheckoutCalls, 1);
    } finally {
      nombaService.createCheckoutOrder = originalCreateCheckoutOrder;
    }
  });

  await t.test("reuses an existing manual reminder invoice when renewal runs", async () => {
    console.log("[BILLING][TEST] reusing manual reminder invoices during renewal");

    const { subscription, currentPeriodEnd } = await seedRenewalFixture();

    subscription.renewalMode = "manual";
    subscription.tokenKey = undefined;
    subscription.nextBillingDate = new Date(Date.now() - 60 * 1000);
    await subscription.save();

    const checkoutCalls: any[] = [];
    nombaService.createCheckoutOrder = (async (params: any) => {
      checkoutCalls.push(params);
      return {
        orderReference: params.orderReference,
        checkoutLink: "https://pay.nomba.com/checkout/manual-reuse",
      };
    }) as any;

    try {
      const reminderCount = await sendUpcomingRenewalReminders(3);
      assert.strictEqual(reminderCount, 1);
      assert.strictEqual(checkoutCalls.length, 1);

      const reminderInvoice = await Invoice.findOne({ subscriptionId: subscription._id });
      assert.ok(reminderInvoice);
      assert.strictEqual(reminderInvoice?.status, "pending");
      assert.strictEqual(reminderInvoice?.checkoutLink, "https://pay.nomba.com/checkout/manual-reuse");

      nombaService.createCheckoutOrder = (async () => {
        throw new Error("renewal should reuse the existing reminder invoice");
      }) as any;

      const result = await processRenewal(subscription._id as Types.ObjectId);

      assert.strictEqual(result.success, true);
      assert.ok(result.invoiceId);

      const updated = await Subscription.findById(subscription._id);
      assert.ok(updated);
      assert.strictEqual(updated?.status, "past_due");
      assert.strictEqual(updated?.dunningAttemptCount, 1);
      assert.strictEqual(
        updated?.currentPeriodEnd?.toISOString(),
        currentPeriodEnd.toISOString()
      );
      assert.ok(updated?.nextBillingDate);
      assert.ok((updated?.nextBillingDate?.getTime() ?? 0) <= Date.now());

      const invoices = await Invoice.find({ subscriptionId: subscription._id });
      assert.strictEqual(invoices.length, 1);

      const attempt = await DunningAttempt.findOne({ subscriptionId: subscription._id });
      assert.ok(attempt);
      assert.strictEqual(attempt?.retryStrategy, "manual");
      assert.strictEqual(attempt?.status, "scheduled");
    } finally {
      nombaService.createCheckoutOrder = originalCreateCheckoutOrder;
    }
  });

  await t.test("WelcomeEmail renders different copy depending on hasPaymentToken", () => {
    console.log("[BILLING][TEST] rendering WelcomeEmail with and without payment token");

    // Case 1: hasPaymentToken is true
    const htmlWithToken = renderToString(
      React.createElement(WelcomeEmail, {
        customerName: "John Doe",
        planName: "Pro Plan",
        amount: "₦5,000.00",
        interval: "month",
        tenantName: "Acme Corp",
        hasPaymentToken: true,
      })
    );
    assert.ok(htmlWithToken.includes("Your card has been securely tokenized"));
    assert.ok(!htmlWithToken.includes("Future renewals will require manual payment"));

    // Case 2: hasPaymentToken is false
    const htmlWithoutToken = renderToString(
      React.createElement(WelcomeEmail, {
        customerName: "John Doe",
        planName: "Pro Plan",
        amount: "₦5,000.00",
        interval: "month",
        tenantName: "Acme Corp",
        hasPaymentToken: false,
      })
    );
    assert.ok(!htmlWithoutToken.includes("Your card has been securely tokenized"));
    assert.ok(htmlWithoutToken.includes("Future renewals will require manual payment"));
  });
});
