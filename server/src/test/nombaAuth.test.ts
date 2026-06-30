import test from "node:test";
import assert from "node:assert";
import { nombaService } from "../services/nomba.service.js";
import { env } from "../config/environment.js";

/**
 * Nomba Auth Service Tests
 *
 * Verifies that the nomba.service.ts can successfully authenticate
 * with the Nomba Sandbox API using the configured hackathon credentials.
 *
 * Per AGENTS.md §2 (Critical Nomba Integration Guidelines)
 */

test("Nomba Auth Integration", async (t) => {
  // Only run this test if credentials are provided in the environment.
  // In CI without secrets, this will be skipped.
  if (!env.NOMBA_CLIENT_ID || !env.NOMBA_CLIENT_SECRET) {
    console.log("Skipping Nomba Auth test: Credentials not configured");
    return;
  }

  await t.test("obtains a valid access token from Sandbox", async () => {
    // Clear any existing cached token
    nombaService.clearTokenCache();
    assert.strictEqual(nombaService.isAuthenticated(), false);

    // Obtain token
    const result = await nombaService.obtainAccessToken();

    // Verify response structure
    assert.ok(result.accessToken, "Should return an access token");
    assert.ok(result.refreshToken, "Should return a refresh token");
    assert.ok(result.expiresIn > 0, "Should have a positive expiry time");

    // Verify state
    assert.strictEqual(nombaService.isAuthenticated(), true);

    // Fetching a valid token again should return the cached one
    const token = await nombaService.getValidToken();
    assert.strictEqual(token, result.accessToken);
  });

  await t.test("refreshes the access token successfully", async () => {
    // We assume the previous test obtained a token and cached the refresh token
    assert.ok(
      nombaService.isAuthenticated(),
      "Service should still be authenticated from previous test"
    );

    const oldToken = await nombaService.getValidToken();

    // Force a refresh
    const result = await nombaService.refreshAccessToken();

    assert.ok(result.accessToken, "Should return a new access token");
    assert.ok(result.refreshToken, "Should return a new refresh token");
    assert.notStrictEqual(
      result.accessToken,
      oldToken,
      "New access token should be different from the old one"
    );
  });

  // Cleanup to avoid polluting other tests
  nombaService.clearTokenCache();
});
