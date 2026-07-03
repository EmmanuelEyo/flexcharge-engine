import { API_BASE_URL } from "./constants";

// ============================================================
// TYPES — mirrors the Nomba Online Checkout API docs exactly
// ============================================================

/** All payment methods supported by Nomba checkout */
export type NombaPaymentMethod =
  | "Card"
  | "Transfer"
  | "Nomba QR"
  | "USSD"
  | "Buy Now Pay Later"
  | "MOMO"
  | "Intl Card"
  | "Apple Pay";

/** ISO 4217 currency codes accepted by Nomba */
export type NombaCurrency = "NGN" | "CDF" | "USD";

/** A single entry in a split payment list */
export interface NombaSplitItem {
  /** Account ID whose wallet will be credited */
  accountId: string;
  /**
   * The amount or percentage to credit, depending on splitType.
   * Use a string to preserve decimal precision (e.g. "65.45").
   */
  value: string | number;
}

/** Split payment configuration */
export interface NombaSplitRequest {
  /** Defaults to AMOUNT if omitted */
  splitType?: "PERCENTAGE" | "AMOUNT";
  splitList: NombaSplitItem[];
}

/**
 * Payload for a public (subscriber-facing) checkout.
 * Sent to POST /api/subscriptions/public-checkout on your backend.
 * The backend then handles all Nomba auth headers internally.
 */
export interface PublicCheckoutPayload {
  /** The plan the customer wants to subscribe to */
  planId: string;
  /** Customer's email address */
  email: string;
  /** Customer's full name */
  name: string;
  /**
   * URL Nomba redirects the customer to after payment.
   * Should be an absolute URL, e.g. https://yourapp.com/pay/success
   */
  returnUrl?: string;
}

/** Response from POST /api/subscriptions/public-checkout */
export interface PublicCheckoutResponse {
  success: boolean;
  data: {
    subscriptionId: string;
    /** Redirect the customer to this URL to complete payment on Nomba */
    checkoutLink: string;
  };
}

// ============================================================
// HELPER — parse error bodies consistently
// ============================================================

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = json as { error?: string; message?: string };
    throw new Error(
      body.error ?? body.message ?? `Request failed with status ${res.status}`
    );
  }
  return json as T;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Create a public checkout session for a subscriber.
 *
 * Full flow:
 *   Browser → POST /api-proxy/api/subscriptions/public-checkout
 *   Next.js rewrites /api-proxy/** → http://localhost:7000/**
 *   Backend:
 *     1. Looks up the plan
 *     2. Finds or creates the customer
 *     3. Creates a pending subscription + invoice
 *     4. Calls Nomba POST /v1/checkout/order with OAuth token + parent accountId header
 *     5. Returns { subscriptionId, checkoutLink }
 *   Browser redirects to checkoutLink (Nomba hosted checkout page)
 *
 * @param payload - planId, email, name, and optional returnUrl
 * @returns subscriptionId and the Nomba checkoutLink to redirect to
 */
export async function createPublicCheckout(
  payload: PublicCheckoutPayload
): Promise<PublicCheckoutResponse["data"]> {
  // Derive absolute returnUrl if not provided
  const returnUrl =
    payload.returnUrl ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/pay/success`
      : undefined);

  const res = await fetch(`${API_BASE_URL}/subscriptions/public-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, returnUrl }),
  });

  const result = await handleResponse<PublicCheckoutResponse>(res);
  return result.data;
}

/**
 * One-shot helper: create a checkout session and immediately redirect
 * the browser to the Nomba checkout page.
 *
 * @example
 * await initiatePublicCheckout({
 *   planId: "64abc123...",
 *   email: "customer@example.com",
 *   name: "Jane Doe",
 * });
 */
export async function initiatePublicCheckout(
  payload: PublicCheckoutPayload
): Promise<void> {
  const { checkoutLink } = await createPublicCheckout(payload);
  window.location.href = checkoutLink;
}
