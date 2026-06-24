import crypto from "crypto";

/**
 * HMAC-SHA256 utilities for webhook signing and verification.
 *
 * Used for:
 * 1. Signing outgoing webhooks to downstream tenants
 * 2. (During hackathon) Verifying incoming Nomba webhook signatures
 */

/**
 * Generate an HMAC-SHA256 signature for a payload.
 *
 * @param payload - The raw JSON string to sign
 * @param secret - The shared secret key (tenant's webhookSecret)
 * @returns The hex-encoded HMAC signature
 */
export function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature using constant-time comparison.
 * Prevents timing attacks by comparing all bytes regardless of match.
 *
 * @param payload - The raw body string
 * @param signature - The signature to verify against
 * @param secret - The shared secret key
 * @returns true if the signature is valid
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signPayload(payload, secret);

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

/**
 * Generate a cryptographically secure random string.
 * Used for API key generation and webhook secrets.
 *
 * @param bytes - Number of random bytes (default 32 = 64 hex chars)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
