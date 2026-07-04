import { test } from "node:test";
import assert from "node:assert";
import { nombaService } from "../services/nomba.service.js";
import { env } from "../config/environment.js";

test("Nomba Sandbox Live Integration Probes", async (t) => {
  if (!env.NOMBA_CLIENT_ID || !env.NOMBA_CLIENT_SECRET) {
    console.log("Skipping Nomba Sandbox Integration test: Credentials not configured");
    return;
  }

  // Obtain a token directly from the service
  const token = await nombaService.getValidToken();

  // Test 1: Checkout Order Probe
  await t.test("Checkout Order Probe: /v1/checkout/order", async () => {
    try {
      // nombaService.createCheckoutOrder now points to /v1/checkout/order universally
      const result = await nombaService.createCheckoutOrder({
        orderReference: `test-sb-${Date.now()}`,
        amount: 500000,
        currency: "NGN",
        customerEmail: "test@example.com",
        callbackUrl: "https://example.com/callback",
      });
      console.log("Order Success:", result);
      assert.ok(result.checkoutLink, "Should return a checkout link");
      assert.ok(result.orderReference, "Should return an order reference");
    } catch (error: any) {
      console.error("Order Failed:", error?.response?.status, error?.response?.data);
      throw error;
    }
  });

  // Test 2: Tokenized Card Charge
  await t.test("Tokenized Card Charge Probe: /v1/checkout/tokenized-card-payment", async () => {
    try {
      // The sandbox allows any token and returns a 200 with code "00"
      const result = await nombaService.chargeTokenizedCard({
        tokenKey: "fake_token_key_123",
        orderReference: `test-charge-${Date.now()}`,
        amount: 500000,
        customerEmail: "test@example.com",
      });
      console.log("Tokenized Charge Result:", result);
      assert.ok(result.success !== undefined, "Charge should have a success boolean");
    } catch (error: any) {
      console.error("Tokenized Charge Failed:", error?.response?.status, error?.response?.data);
      throw error;
    }
  });
});
