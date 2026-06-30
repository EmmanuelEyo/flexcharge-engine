import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import { Types } from "mongoose";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { WebhookDelivery } from "../models/WebhookDelivery.js";
import { nombaService } from "../services/nomba.service.js";
import crypto from "node:crypto";
import { env } from "../config/environment.js";

const originalIsConfigured = nombaService.isConfigured;
const originalVerifyTransaction = nombaService.verifyTransaction;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for asynchronous webhook processing");
}

test("Nomba Webhook Flow", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    nombaService.isConfigured = originalIsConfigured;
    nombaService.verifyTransaction = originalVerifyTransaction;
  });

  t.after(async () => {
    nombaService.isConfigured = originalIsConfigured;
    nombaService.verifyTransaction = originalVerifyTransaction;
    await teardownTestDB();
  });

  await t.test("activates a pending subscription and rejects duplicate webhook processing", async () => {
    console.log("[WEBHOOK][TEST] exercising Nomba payment_success ingestion");

    const tenant = await Tenant.create({
      name: "Webhook Tenant",
      email: `webhook-${Date.now()}@example.com`,
      passwordHash: "hashed-password",
      webhookSecret: "webhook-secret",
      webhookUrl: "https://tenant.example/webhooks/flexcharge",
    });

    const customer = await Customer.create({
      tenantId: tenant._id,
      email: `webhook-customer-${Date.now()}@example.com`,
      name: "Webhook Customer",
    });

    const plan = await Plan.create({
      tenantId: tenant._id,
      name: "Webhook Monthly",
      slug: `webhook-monthly-${Date.now()}`,
      amount: 500000,
      currency: "NGN",
      interval: "monthly",
      features: ["Webhook"],
    });

    const subscription = await Subscription.create({
      tenantId: tenant._id,
      customerId: customer._id,
      planId: plan._id,
      status: "pending",
      nombaCheckoutOrderRef: "order_success_123",
      metadata: { channel: "checkout" },
    });

    const invoice = await Invoice.create({
      tenantId: tenant._id,
      subscriptionId: subscription._id,
      customerId: customer._id,
      amount: plan.amount,
      currency: "NGN",
      status: "pending",
      nombaOrderReference: "order_success_123",
      description: "Initial checkout",
      isRenewal: false,
      idempotencyKey: `initial_${subscription._id}`,
    });

    nombaService.isConfigured = () => true;
    nombaService.verifyTransaction = (async () => ({
      status: "SUCCESS",
      transactionId: "txn_webhook_123",
      tokenizedCardData: {
        tokenKey: "tok_webhook_123",
        cardLast4: "4242",
        cardBrand: "VISA",
      },
    })) as any;

    const payload = {
      event_type: "payment_success",
      data: {
        orderReference: "order_success_123",
        status: "SUCCESS",
        transactionId: "txn_webhook_123",
      },
    };

    const rawPayload = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    const validSecret = env.NOMBA_WEBHOOK_SECRET || "NombaHackathon2026";
    
    // Minimal signature logic for this mock payload
    const eventType = payload.event_type || "";
    const requestId = "";
    const userId = "";
    const walletId = "";
    const transactionId = "";
    const transactionType = "";
    const transactionTime = "";
    const transactionResponseCode = "";
    
    const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timestamp}`;
    const hmac = crypto.createHmac("sha256", validSecret);
    hmac.update(hashingPayload);
    const signature = hmac.digest("base64");

    const firstResponse = await request(app)
      .post("/webhooks/nomba")
      .set("Content-Type", "application/json")
      .set("nomba-signature", signature)
      .set("nomba-timestamp", timestamp)
      .send(rawPayload)
      .expect(200);

    assert.strictEqual(firstResponse.text, "OK");

    await waitFor(async () => {
      const updated = await Subscription.findById(subscription._id);
      return updated?.status === "active";
    });

    const updatedSubscription = await Subscription.findById(subscription._id);
    const updatedInvoice = await Invoice.findById(invoice._id);
    const deliveriesAfterFirst = await WebhookDelivery.countDocuments();

    assert.ok(updatedSubscription);
    assert.strictEqual(updatedSubscription?.status, "active");
    assert.strictEqual(updatedSubscription?.tokenKey, "tok_webhook_123");
    assert.strictEqual(updatedSubscription?.cardLast4, "4242");
    assert.strictEqual(updatedSubscription?.cardBrand, "VISA");
    assert.ok(updatedSubscription?.currentPeriodStart);
    assert.ok(updatedSubscription?.currentPeriodEnd);
    assert.ok(updatedSubscription?.nextBillingDate);

    assert.ok(updatedInvoice);
    assert.strictEqual(updatedInvoice?.status, "paid");
    assert.strictEqual(updatedInvoice?.nombaTransactionId, "txn_webhook_123");
    assert.strictEqual(deliveriesAfterFirst, 1);

    await request(app)
      .post("/webhooks/nomba")
      .set("Content-Type", "application/json")
      .set("nomba-signature", signature)
      .set("nomba-timestamp", timestamp)
      .send(rawPayload)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const deliveryCountAfterDuplicate = await WebhookDelivery.countDocuments();
    const subscriptionAfterDuplicate = await Subscription.findById(subscription._id);
    const invoiceAfterDuplicate = await Invoice.findById(invoice._id);

    assert.strictEqual(deliveryCountAfterDuplicate, 1);
    assert.strictEqual(subscriptionAfterDuplicate?.status, "active");
    assert.strictEqual(invoiceAfterDuplicate?.status, "paid");
  });
});
