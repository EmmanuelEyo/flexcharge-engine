import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Subscription } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Invoice } from "../models/Invoice.js";
import { Customer } from "../models/Customer.js";
import { Tenant } from "../models/Tenant.js";
import { ApiKey } from "../models/ApiKey.js";

let tenantApiKey: string;
let customerId: mongoose.Types.ObjectId;
let tenantId: mongoose.Types.ObjectId;
let portalToken: string;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  // Create Tenant
  const tenant = await Tenant.create({
    name: "Acme Corp",
    email: "admin@acme.com",
    passwordHash: "hashed",
    webhookSecret: "secret",
  });
  tenantId = tenant._id as mongoose.Types.ObjectId;

  // Create API Key
  const { rawKey } = await ApiKey.generateKey(tenantId, "Test Key");
  tenantApiKey = rawKey;

  // Create Customer
  const customer = await Customer.create({
    tenantId,
    email: "portal-user@test.com",
    name: "Portal Customer",
  });
  customerId = customer._id as mongoose.Types.ObjectId;

  // Create Portal Session
  const sessionRes = await request(app)
    .post("/api/portal/sessions")
    .set("x-api-key", tenantApiKey)
    .send({ customerId: customerId.toString() })
    .expect(201);

  portalToken = sessionRes.body.data.portalToken;
});

test("Portal Self-Service Endpoints", async () => {
  // Create Plan
  const plan = await Plan.create({
    tenantId,
    name: "Standard",
    slug: "std",
    amount: 1000,
    currency: "NGN",
    interval: "monthly",
    features: [],
  });

  // Create Subscription
  const subscription = await Subscription.create({
    tenantId,
    customerId,
    planId: plan._id,
    status: "active",
  });

  // Create Invoice
  await Invoice.create({
    tenantId,
    customerId,
    subscriptionId: subscription._id,
    amount: 1000,
    currency: "NGN",
    status: "paid",
  });

  // Test GET /portal/subscription
  const subRes = await request(app)
    .get("/api/portal/subscription")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(200);

  assert.strictEqual(subRes.body.data._id, subscription.id);

  // Test GET /portal/invoices
  const invRes = await request(app)
    .get("/api/portal/invoices")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(200);

  assert.strictEqual(invRes.body.data.length, 1);

  // Test POST /portal/update-payment-method
  const payRes = await request(app)
    .post("/api/portal/update-payment-method")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(200);

  assert.ok(payRes.body.data.checkoutLink);

  // Test POST /portal/cancel
  const cancelRes = await request(app)
    .post("/api/portal/cancel")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(200);

  assert.strictEqual(cancelRes.body.data.cancelAtPeriodEnd, true);
});
