import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Subscription } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Customer } from "../models/Customer.js";
import { Tenant } from "../models/Tenant.js";
import { ApiKey } from "../models/ApiKey.js";

let tenantId: mongoose.Types.ObjectId;
let customerId: mongoose.Types.ObjectId;
let planAId: mongoose.Types.ObjectId;
let planBId: mongoose.Types.ObjectId;
let apiKeyStr: string;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  const tenant = await Tenant.create({
    name: "Test Tenant",
    email: "test@flexcharge.com",
    passwordHash: "hashed",
    webhookSecret: "secret",
  });
  tenantId = tenant._id as mongoose.Types.ObjectId;

  const { rawKey } = await ApiKey.generateKey(tenantId, "Test Key");
  apiKeyStr = rawKey;

  const customer = await Customer.create({
    tenantId,
    email: "customer@example.com",
    name: "John Doe",
  });
  customerId = customer._id as mongoose.Types.ObjectId;

  const planA = await Plan.create({
    tenantId,
    name: "Plan A",
    slug: "plan-a",
    amount: 500000,
    currency: "NGN",
    interval: "monthly",
    features: [],
  });
  planAId = planA._id as mongoose.Types.ObjectId;

  const planB = await Plan.create({
    tenantId,
    name: "Plan B",
    slug: "plan-b",
    amount: 1000000,
    currency: "NGN",
    interval: "monthly",
    features: [],
  });
  planBId = planB._id as mongoose.Types.ObjectId;
});

test("Subscription Lifecycle - Pause and Resume", async () => {
  const subscription = await Subscription.create({
    tenantId,
    customerId,
    planId: planAId,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 86400000),
  });

  const pauseRes = await request(app)
    .post(`/api/subscriptions/${subscription._id}/pause`)
    .set("x-api-key", apiKeyStr)
    .expect(200);
  
  assert.strictEqual(pauseRes.body.data.status, "paused");

  const resumeRes = await request(app)
    .post(`/api/subscriptions/${subscription._id}/resume`)
    .set("x-api-key", apiKeyStr)
    .expect(200);

  assert.strictEqual(resumeRes.body.data.status, "active");
});

test("Subscription Lifecycle - Simulate Change Plan", async () => {
  const subscription = await Subscription.create({
    tenantId,
    customerId,
    planId: planAId,
    status: "active",
    currentPeriodStart: new Date(Date.now() - 15 * 86400000), // 15 days ago
    currentPeriodEnd: new Date(Date.now() + 15 * 86400000), // 15 days from now
  });

  const simRes = await request(app)
    .post(`/api/subscriptions/${subscription._id}/simulate-change`)
    .set("x-api-key", apiKeyStr)
    .send({ newPlanId: planBId.toString() })
    .expect(200);

  assert.strictEqual(simRes.body.data.simulation, true);
  assert.strictEqual(simRes.body.data.proration.type, "upgrade");
  assert.strictEqual(simRes.body.data.subscription.newPlanId, planBId.toString());
});
