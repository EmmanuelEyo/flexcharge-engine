import test from "node:test";
import assert from "node:assert";
import { classifyDeclineCode } from "../config/declineCodeMap.js";

test("Decline Code Classification", async (t) => {
  await t.test("classifies insufficient funds as a soft payday-aligned decline", () => {
    console.log("[DUNNING][TEST] classifying decline code 51");

    const classification = classifyDeclineCode("51");

    assert.strictEqual(classification.category, "insufficient_funds");
    assert.strictEqual(classification.type, "soft");
    assert.strictEqual(classification.retryStrategy, "payday_aligned");
  });

  await t.test("classifies card expired as a hard no-retry decline", () => {
    console.log("[DUNNING][TEST] classifying decline code 54");

    const classification = classifyDeclineCode("54");

    assert.strictEqual(classification.category, "card_expired");
    assert.strictEqual(classification.type, "hard");
    assert.strictEqual(classification.retryStrategy, "none");
  });

  await t.test("falls back to an exponential soft decline for unknown codes", () => {
    console.log("[DUNNING][TEST] classifying unknown decline code ZZ");

    const classification = classifyDeclineCode("ZZ");

    assert.strictEqual(classification.category, "unknown");
    assert.strictEqual(classification.type, "soft");
    assert.strictEqual(classification.retryStrategy, "exponential");
  });
});
