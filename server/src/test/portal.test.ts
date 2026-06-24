import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";

let tenantToken: string;
let tenantApiKey: string;
let customerId: string;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();

  // 1. Create Tenant
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

  // 2. Create Customer
  const custRes = await request(app)
    .post("/api/customers")
    .set("x-api-key", tenantApiKey)
    .send({
      email: "portal-user@test.com",
      name: "Portal Customer",
    })
    .expect(201);
  customerId = custRes.body.data._id;
});

test("Customer Portal Session — E2E Flow", async () => {
  // Generate portal session token
  const sessionRes = await request(app)
    .post("/api/portal/sessions")
    .set("x-api-key", tenantApiKey)
    .send({ customerId })
    .expect(201);

  assert.strictEqual(sessionRes.body.success, true);
  const portalToken = sessionRes.body.data.portalToken;
  assert.ok(portalToken);
  assert.ok(sessionRes.body.data.portalUrl);

  // Authenticate customer portal request using the portalToken
  const profileRes = await request(app)
    .get("/api/portal/me")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(200);

  assert.strictEqual(profileRes.body.success, true);
  assert.strictEqual(profileRes.body.data._id, customerId);
  assert.strictEqual(profileRes.body.data.name, "Portal Customer");
});

test("Customer Portal Session — Security Isolation Constraints", async () => {
  // Generate portal session token
  const sessionRes = await request(app)
    .post("/api/portal/sessions")
    .set("x-api-key", tenantApiKey)
    .send({ customerId })
    .expect(201);

  const portalToken = sessionRes.body.data.portalToken;

  // 1. Verify standard Tenant JWT cannot access Customer portal route
  await request(app)
    .get("/api/portal/me")
    .set("Authorization", `Bearer ${tenantToken}`)
    .expect(401);

  // 2. Verify Customer portal token cannot access Tenant auth routes (e.g. list API keys)
  await request(app)
    .get("/api/auth/api-keys")
    .set("Authorization", `Bearer ${portalToken}`)
    .expect(401);
});
