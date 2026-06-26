import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Plan } from "../models/Plan.js";
import { Customer } from "../models/Customer.js";

let tenantToken: string;
let tenantApiKey: string;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  // Create standard test tenant
  const reg = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Acme Corp",
      email: "admin@acme.com",
      password: "SecurePassword123",
    })
    .expect(201);
  tenantToken = reg.body.data.token;

  const keyRes = await request(app)
    .post("/api/auth/api-keys")
    .set("Authorization", `Bearer ${tenantToken}`)
    .send({ name: "Test Key" })
    .expect(201);
  tenantApiKey = keyRes.body.data.rawKey;
});

test("Plan Creation & Retrieval Flow", async () => {
  // Create Plan
  const createRes = await request(app)
    .post("/api/plans")
    .set("x-api-key", tenantApiKey)
    .send({
      name: "Pro Monthly Plan",
      amount: 500000, // ₦5,000 in kobo
      currency: "NGN",
      interval: "monthly",
      trialDays: 7,
      features: ["Unlimited usage", "Premium support"],
    })
    .expect(201);

  assert.strictEqual(createRes.body.success, true);
  assert.strictEqual(createRes.body.data.name, "Pro Monthly Plan");
  assert.strictEqual(createRes.body.data.slug, "pro-monthly-plan"); // Auto-slugified
  assert.strictEqual(createRes.body.data.amount, 500000);

  const planId = createRes.body.data._id;

  // Retrieve plan details
  const getRes = await request(app)
    .get(`/api/plans/${planId}`)
    .set("x-api-key", tenantApiKey)
    .expect(200);

  assert.strictEqual(getRes.body.success, true);
  assert.strictEqual(getRes.body.data.name, "Pro Monthly Plan");

  // List all plans
  const listRes = await request(app)
    .get("/api/plans")
    .set("x-api-key", tenantApiKey)
    .expect(200);

  assert.strictEqual(listRes.body.success, true);
  assert.strictEqual(listRes.body.data.length, 1);
});

test("Customer Registration & Search", async () => {
  // Create Customer
  const custRes = await request(app)
    .post("/api/customers")
    .set("x-api-key", tenantApiKey)
    .send({
      email: "customer@test.com",
      name: "John Doe",
      phone: "+2348000000000",
      metadata: { department: "Engineering" },
    })
    .expect(201);

  assert.strictEqual(custRes.body.success, true);
  assert.strictEqual(custRes.body.data.email, "customer@test.com");
  assert.strictEqual(custRes.body.data.name, "John Doe");

  const custId = custRes.body.data._id;

  // Retrieve Customer
  const detailsRes = await request(app)
    .get(`/api/customers/${custId}`)
    .set("x-api-key", tenantApiKey)
    .expect(200);

  assert.strictEqual(detailsRes.body.success, true);
  assert.strictEqual(detailsRes.body.data.email, "customer@test.com");

  // Validate duplicate email checks per tenant (should throw 409 Conflict)
  await request(app)
    .post("/api/customers")
    .set("x-api-key", tenantApiKey)
    .send({
      email: "customer@test.com",
      name: "Another John",
    })
    .expect(409);
});
