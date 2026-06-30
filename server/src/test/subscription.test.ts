import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import { setupTestDB, clearTestDB, teardownTestDB } from "./setup.js";
import { Subscription } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Customer } from "../models/Customer.js";
import { Tenant } from "../models/Tenant.js";
import { ApiKey } from "../models/ApiKey.js";

/**
 * Subscription Controller & State Machine Tests
 */

let tenantId: mongoose.Types.ObjectId;
let customerId: mongoose.Types.ObjectId;
let planId: mongoose.Types.ObjectId;
let apiKeyStr: string;

test("Subscription Controller", async (t) => {
  await setupTestDB();

  // Setup mock data before tests
  t.beforeEach(async () => {
    await clearTestDB();

    // 1. Create a Tenant
    const tenant = await Tenant.create({
      name: "Test Tenant",
      email: "test@flexcharge.com",
      passwordHash: "hashed",
      webhookSecret: "secret",
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    // 2. Create an API Key for auth
    const { rawKey } = await ApiKey.generateKey(tenantId, "Test Key");
    apiKeyStr = rawKey;

    // 3. Create a Customer
    const customer = await Customer.create({
      tenantId,
      email: "customer@example.com",
      name: "John Doe",
    });
    customerId = customer._id as mongoose.Types.ObjectId;

    // 4. Create a Plan
    const plan = await Plan.create({
      tenantId,
      name: "Pro Plan",
      slug: "pro-plan",
      amount: 1000000, // 10k NGN
      currency: "NGN",
      interval: "monthly",
      features: [],
    });
    planId = plan._id as mongoose.Types.ObjectId;
  });

  await t.test("POST /subscriptions - creates a pending subscription", async () => {
    const res = await request(app)
      .post("/api/subscriptions")
      .set("x-api-key", apiKeyStr)
      .send({
        customerId: customerId.toString(),
        planId: planId.toString(),
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.subscription.status, "pending");
    assert.strictEqual(res.body.data.subscription.customerId, customerId.toString());
    assert.strictEqual(res.body.data.subscription.planId, planId.toString());
    
    // Check that a pending invoice was created implicitly
    assert.ok(res.body.data.invoiceId, "Should return the initial invoice ID");
  });

  await t.test("POST /subscriptions/:id/cancel - graceful cancellation", async () => {
    // 1. Create an active subscription
    const subscription = await Subscription.create({
      tenantId,
      customerId,
      planId,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 86400000), // tomorrow
    });

    // 2. Cancel it gracefully
    const res = await request(app)
      .post(`/api/subscriptions/${subscription._id}/cancel`)
      .set("x-api-key", apiKeyStr)
      .send({
        cancelAtPeriodEnd: true,
        cancellationReason: "Too expensive",
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    
    // Status should still be active, but flag should be set
    assert.strictEqual(res.body.data.status, "active");
    assert.strictEqual(res.body.data.cancelAtPeriodEnd, true);
    assert.strictEqual(res.body.data.cancellationReason, "Too expensive");
  });

  await t.test("POST /subscriptions/:id/cancel - immediate cancellation", async () => {
    // 1. Create an active subscription
    const subscription = await Subscription.create({
      tenantId,
      customerId,
      planId,
      status: "active",
    });

    // 2. Cancel it immediately
    const res = await request(app)
      .post(`/api/subscriptions/${subscription._id}/cancel`)
      .set("x-api-key", apiKeyStr)
      .send({
        cancelAtPeriodEnd: false,
        cancellationReason: "Not using it",
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    
    // Status should be canceled immediately
    assert.strictEqual(res.body.data.status, "canceled");
    assert.strictEqual(res.body.data.cancelAtPeriodEnd, false);
    assert.ok(res.body.data.canceledAt, "Should have a canceledAt date");
  });

  await t.test("State Machine Validation - prevents invalid transitions", async () => {
    // pending -> past_due is INVALID
    const subscription = await Subscription.create({
      tenantId,
      customerId,
      planId,
      status: "pending",
    });

    let errorThrown = false;
    try {
      (subscription as any)._previousStatus = "pending";
      subscription.status = "past_due";
      await subscription.save();
    } catch (error: any) {
      errorThrown = true;
      assert.ok(error.message.includes("Invalid subscription state transition"));
    }

    assert.strictEqual(errorThrown, true, "Should have thrown a validation error");
  });

  await teardownTestDB();
});
