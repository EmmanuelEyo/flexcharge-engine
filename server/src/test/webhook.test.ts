import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { signPayload, verifySignature } from "../utils/hmac.js";

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

test("HMAC Payload Signing & Verification", () => {
  const payload = JSON.stringify({ event: "subscription.created", amount: 500000 });
  const secret = "my_super_secret_webhook_signature_key";

  // Sign payload
  const signature = signPayload(payload, secret);

  assert.ok(signature);
  assert.strictEqual(signature.length, 64); // SHA-256 HMAC returns 64 character hex string

  // Verify signature — valid case
  const isValid = verifySignature(payload, signature, secret);
  assert.strictEqual(isValid, true);

  // Verify signature — invalid secret case
  const isInvalidSecret = verifySignature(payload, signature, "wrong_secret");
  assert.strictEqual(isInvalidSecret, false);
});
