import { test, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../app.js";
import { setupTestDB, teardownTestDB } from "./setup.js";

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

import crypto from "node:crypto";
import { env } from "../config/environment.js";

test("Nomba Webhook Security \u0026 Ingestion Receiver", async (t) => {
  const payload = {
    event_type: "payment_success",
    requestId: "req_123456789",
    data: {
      transaction: {
        transactionId: "txn_987654321",
        type: "online_checkout",
        time: "2026-03-31T10:00:00Z",
        responseCode: "00",
      },
      merchant: {
        userId: "user_merchant_1",
        walletId: "wallet_merchant_1",
      },
      order: {
        orderReference: "test-order-001"
      }
    },
  };

  const rawPayload = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  
  // Helper to generate signature
  const generateSig = (secret: string) => {
    const eventType = payload.event_type || "";
    const requestId = payload.requestId || "";
    const data = payload.data || {};
    const merchant = data.merchant || {};
    const transaction = data.transaction || {};
    const userId = merchant.userId || "";
    const walletId = merchant.walletId || "";
    const transactionId = transaction.transactionId || "";
    const transactionType = transaction.type || "";
    const transactionTime = transaction.time || "";
    const transactionResponseCode = transaction.responseCode || "";

    const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timestamp}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(hashingPayload);
    return hmac.digest("base64");
  };

  await t.test("Valid signature returns 200 OK", async () => {
    const validSecret = env.NOMBA_WEBHOOK_SECRET || "NombaHackathon2026";
    const signature = generateSig(validSecret);

    const response = await request(app)
      .post("/webhooks/nomba")
      .set("Content-Type", "application/json")
      .set("nomba-signature", signature)
      .set("nomba-timestamp", timestamp)
      .send(rawPayload)
      .expect(200);

    assert.strictEqual(response.text, "OK");
  });

  await t.test("Invalid signature returns 401 Unauthorized", async () => {
    const invalidSecret = "wrong_secret_key";
    const signature = generateSig(invalidSecret);

    const response = await request(app)
      .post("/webhooks/nomba")
      .set("Content-Type", "application/json")
      .set("nomba-signature", signature)
      .set("nomba-timestamp", timestamp)
      .send(rawPayload)
      .expect(401);

    assert.strictEqual(response.text, "Unauthorized");
  });
  
  await t.test("Missing signature headers returns 401 Unauthorized", async () => {
    const response = await request(app)
      .post("/webhooks/nomba")
      .set("Content-Type", "application/json")
      .send(rawPayload)
      .expect(401);

    assert.strictEqual(response.text, "Unauthorized");
  });
});
