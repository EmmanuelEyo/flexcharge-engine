import { test } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Wallet } from "../models/Wallet.js";
import { Invoice } from "../models/Invoice.js";
import { nombaService } from "../services/nomba.service.js";
import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";

async function seedPortalWalletFixture() {
  const tenant = await Tenant.create({
    name: "Portal Tenant",
    email: `portal-tenant-${Date.now()}@example.com`,
    passwordHash: "hashed_password",
  });

  const customer = await Customer.create({
    tenantId: tenant._id,
    email: `portal-customer-${Date.now()}@example.com`,
    name: "Portal Customer",
  });

  const wallet = await Wallet.create({
    tenantId: tenant._id,
    customerId: customer._id,
    balance: 5000,
    currency: "NGN",
    autoTopUp: false,
    autoTopUpAmount: 0,
    autoTopUpTrigger: 0,
  });

  const portalToken = jwt.sign(
    {
      customerId: customer._id.toString(),
      tenantId: tenant._id.toString(),
      type: "portal",
    },
    env.PORTAL_JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { tenant, customer, wallet, portalToken };
}

test("Portal Wallet Endpoints", async (t) => {
  await setupTestDB();

  t.after(async () => {
    await teardownTestDB();
  });

  t.beforeEach(async () => {
    await clearTestDB();
    nombaService.createCheckoutOrder = async (params: any) => ({
      success: true,
      message: "success",
      checkoutLink: `https://pay.nomba.com/checkout/mock_manual_topup`,
      orderReference: params.orderReference,
    }) as any;
  });

  await t.test("GET /api/portal/wallet - fetches wallet", async () => {
    const { wallet, portalToken } = await seedPortalWalletFixture();

    const res = await request(app)
      .get("/api/portal/wallet")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.balance, 5000);
    assert.strictEqual(res.body.data.currency, "NGN");
  });

  await t.test("POST /api/portal/wallet/settings - updates auto-topup", async () => {
    const { wallet, portalToken } = await seedPortalWalletFixture();

    const res = await request(app)
      .post("/api/portal/wallet/settings")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({
        autoTopUp: true,
        autoTopUpAmount: 1000000,
        autoTopUpTrigger: 50000,
      })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.autoTopUp, true);
    assert.strictEqual(res.body.data.autoTopUpAmount, 1000000);
    assert.strictEqual(res.body.data.autoTopUpTrigger, 50000);

    const updatedWallet = await Wallet.findById(wallet._id);
    assert.strictEqual(updatedWallet?.autoTopUp, true);
    assert.strictEqual(updatedWallet?.autoTopUpAmount, 1000000);
  });

  await t.test("POST /api/portal/wallet/topup - initiates top-up", async () => {
    const { wallet, portalToken } = await seedPortalWalletFixture();

    const res = await request(app)
      .post("/api/portal/wallet/topup")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({
        amount: 250000, // 2,500 NGN
      })
      .expect(200); // Changed to 200 to match sendSuccess

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.checkoutLink.includes("mock_manual_topup"));
    assert.ok(res.body.data.orderReference.startsWith(`man_topup_${wallet._id}_`));

    // Check if pending invoice was created
    const invoice = await Invoice.findOne({ nombaOrderReference: res.body.data.orderReference });
    assert.ok(invoice);
    assert.strictEqual(invoice.amount, 250000);
    assert.strictEqual(invoice.status, "pending");
  });
});
