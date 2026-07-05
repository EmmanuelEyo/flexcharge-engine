import axios, { AxiosInstance, AxiosError } from "axios";
import { env } from "../config/environment.js";
import { logger } from "../utils/logger.js";

/**
 * Nomba Service — Centralized client for all Nomba API interactions.
 *
 * This service handles:
 * 1. OAuth token management (obtain, cache, refresh)
 * 2. Checkout order creation (with card tokenization)
 * 3. Tokenized card charging (recurring billing)
 * 4. Transaction verification (sub-account scoped)
 *
 * CRITICAL SANDBOX NOTES (per AGENTS.md §2):
 * - Checkout orders in Sandbox use: POST /sandbox/checkout/order
 * - Tokenized card charges use: POST /v1/checkout/tokenized-card-payment
 * - Transaction verification for sub-accounts uses:
 *   GET /v1/transactions/accounts/{subAccountId}/single
 * - Access tokens expire in 30 minutes — we refresh every 25 minutes.
 *
 * Per overall_implementation_plan.md §5 and AGENTS.md §2
 */

// ============================================================
// TYPES
// ============================================================

interface NombaTokenResponse {
  code: string;
  description: string;
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number; // seconds
    token_type: string;
    businessId?: string;
  };
}

interface NombaCheckoutOrderResponse {
  code: string;
  description: string;
  data: {
    orderReference: string;
    checkoutLink: string;
  };
}

/**
 * Response shape for GET /v1/checkout/order/{orderReference}
 * Matches the Nomba API spec exactly.
 */
interface NombaCheckoutOrderDetailsResponse {
  code: string;
  description: string;
  data: {
    order: {
      orderId: string;
      orderReference: string;
      customerId: string;
      accountId: string;
      callbackUrl: string;
      customerEmail: string;
      amount: string;         // Decimal string e.g. "10000.00"
      currency: string;       // "NGN"
      businessName: string;
      businessEmail: string;
      businessLogo: string;
    };
    hasSavedCards: boolean;
    base64EncodedRsaPublicKey: string;
  };
}

/**
 * Response shape for POST /v1/checkout/tokenized-card-payment
 * Matches the Nomba API spec exactly.
 *
 * The docs show:
 *   { "code": "00", "description": "Success", "data": { "status": true, "message": "success" } }
 *
 * NOTE: status is a BOOLEAN (or boolean string "true"/"false") per docs —
 * NOT "SUCCESS"/"APPROVED". The outer `code` field is the primary success indicator.
 */
interface NombaTokenizedChargeResponse {
  code: string;
  description: string;
  data: {
    // Nomba returns this as boolean true/false per their docs
    // In practice may arrive as string "true"/"false" — we normalise it below
    status: boolean | string;
    message?: string;
  };
}

interface NombaTransactionStatusResponse {
  code: string;
  description: string;
  data: {
    amount: number;
    status: string;          // "SUCCESS", "FAILED", "PENDING"
    transactionId?: string;
    transactionRef?: string;
    type?: string;
    tokenizedCardData?: {
      tokenKey: string;
      cardLast4: string;
      cardBrand: string;
    };
  };
}

/**
 * Response shape for GET /v1/checkout/transaction
 * Matches the Nomba API spec exactly.
 *
 * NOTE: This is DIFFERENT from verifyTransaction which calls
 * /v1/transactions/accounts/{subAccountId}/single (the ledger/Transactions API).
 * This endpoint is the dedicated *checkout* transaction status endpoint.
 */
interface NombaCheckoutTransactionResponse {
  code: string;
  description: string;
  data: {
    success: boolean;         // true = transaction completed and approved
    message: string;          // human-readable status e.g. "success"
    order: {
      orderId: string;
      orderReference: string;
      customerId: string;
      accountId: string;
      callbackUrl: string;
      customerEmail: string;
      amount: string;         // Decimal Naira string e.g. "10000.00"
      currency: string;       // "NGN"
    };
    transactionDetails?: {
      transactionDate: string;          // ISO 8601 datetime
      paymentReference: string;
      paymentVendorReference: string;
      tokenizedCardPayment: boolean;    // true if paid via tokenized card
      statusCode: string;               // e.g. "Payment approved"
    };
    transferDetails?: {
      sessionId: string;
      beneficiaryAccountName: string;
      beneficiaryAccountNumber: string;
      originatorAccountName: string;
      originatorAccountNumber: string;
      narration: string;
      destinationInstitutionCode: string;
      paymentReference: string;
    };
    cardDetails?: {
      cardPan: string;        // Masked PAN e.g. "515123 **** **** 6667"
      cardType: string;       // e.g. "Verve"
      cardCurrency: string;   // e.g. "NGN"
      cardBank: string;       // Bank code e.g. "057"
    };
  };
}

/**
 * A single tokenized card record.
 * Shared shape returned by both:
 *   - GET /v1/checkout/tokenized-card-data        (merchant list — all tokenized cards)
 *   - GET /v1/checkout/user-card/{orderReference} (user saved cards — OTP-gated)
 */
export interface NombaTokenizedCardItem {
  /** The token key — use this as `tokenKey` when charging */
  tokenKey: string;
  /** Customer email associated with this card */
  customerEmail: string;
  /** Card network/type e.g. "Verve", "Mastercard", "Visa" */
  cardType: string;
  /** Masked card PAN e.g. "234818********7580" */
  cardPan: string;
  /** Token expiration date in MM/YY format e.g. "20/20" */
  tokenExpirationDate: string;
}

/**
 * Response shape for GET /v1/checkout/tokenized-card-data
 * Lists all of the merchant's tokenized cards with optional filters.
 *
 * Query params: customerEmail, startDate, endDate, page (0-indexed)
 * Header: accountId (required — parent account UUID)
 */
interface NombaListTokenizedCardsResponse {
  code: string;
  description: string;
  data: {
    /** Next page number as a string integer; "0" means no more pages */
    nextPage: string;
    tokenizedCardDataList: NombaTokenizedCardItem[];
  };
}

/**
 * Response shape for GET /v1/checkout/user-card/{orderReference}
 * Gets the saved cards for a specific customer, gated by an OTP.
 *
 * Requires:
 *  - Path:  orderReference (the original checkout order reference)
 *  - Query: otp            (one-time code sent to the user's mobile number via
 *                           POST /checkout/user-card/saved-card/auth)
 */
interface NombaGetUserSavedCardsResponse {
  code: string;
  description: string;
  data: {
    tokenizedCardData: NombaTokenizedCardItem[];
  };
}

/**
 * Shared response shape for all three OTP trigger/submit endpoints:
 *   - POST /v1/checkout/user-card/saved-card/auth  (trigger OTP to fetch saved cards)
 *   - POST /v1/checkout/user-card/auth             (trigger OTP to save a card)
 *   - POST /v1/checkout/user-card                  (submit OTP to confirm card save)
 *
 * Per Nomba API docs the response is identical for all three — only the
 * semantics of what "success" means differ.
 *
 * Note: Nomba returns `success` as the string "true" / "false" in this family
 * of endpoints (not a boolean). We normalize it to a boolean in our service methods.
 */
interface NombaOtpActionResponse {
  code: string;
  description: string;
  data: {
    success: string | boolean;  // Nomba sends "true" as a string; we normalize
    message: string;
  };
}

export type NombaPaymentMethod =
  | "Card"
  | "Transfer"
  | "Nomba QR"
  | "USSD"
  | "Buy Now Pay Later"
  | "MOMO"
  | "Intl Card"
  | "Apple Pay";

export interface NombaSplitItem {
  /** The account whose wallet will be credited */
  accountId: string;
  /** Percentage or absolute amount to credit, depending on splitType */
  value: string | number;
}

export interface NombaSplitRequest {
  /** PERCENTAGE or AMOUNT — defaults to AMOUNT if omitted */
  splitType?: "PERCENTAGE" | "AMOUNT";
  splitList: NombaSplitItem[];
}

export interface CreateCheckoutParams {
  orderReference: string;
  amount: number;         // In KOBO — we convert to NGN string for Nomba
  currency?: "NGN" | "CDF" | "USD";
  customerEmail: string;
  callbackUrl: string;
  tokenizeCard?: boolean;
  /** Optional: customer identifier */
  customerId?: string;
  /** Optional: sub-account where funds will be deposited */
  accountId?: string;
  /** Optional: restrict which payment methods appear on the checkout page */
  allowedPaymentMethods?: NombaPaymentMethod[];
  /** Optional: split the inflow across multiple accounts */
  splitRequest?: NombaSplitRequest;
  /**
   * Optional: arbitrary key-value metadata attached to the order.
   * Special key — set { region: "CD" } to route through DRC checkout.
   */
  orderMetaData?: Record<string, string>;
}

export interface ChargeTokenizedCardParams {
  /** The token key returned by Nomba's tokenization webhook */
  tokenKey: string;
  /** Merchant-supplied order reference (idempotency key for this charge) */
  orderReference: string;
  /** Charge amount in KOBO — converted to Naira decimal string before sending to Nomba */
  amount: number;
  /** ISO 4217 currency. Use NGN for Nigeria, CDF/USD for DRC. Defaults to NGN. */
  currency?: "NGN" | "CDF" | "USD";
  /** Customer email — required by Nomba within the order object */
  customerEmail: string;
  /** Optional: customer identifier for Nomba's records */
  customerId?: string;
  /**
   * Required by Nomba per docs when sending the order object.
   * For server-side recurring charges, defaults to the frontend success page.
   * Nomba uses this URL to redirect the customer after payment (not applicable
   * for server-side tokenized charges, but the field is required in the API).
   */
  callbackUrl?: string;
  /** Optional: sub-account where funds will be deposited. Defaults to NOMBA_SUB_ACCOUNT_ID. */
  accountId?: string;
  /** Optional: restrict which payment methods appear on the checkout page */
  allowedPaymentMethods?: NombaPaymentMethod[];
  /** Optional: split the inflow across multiple accounts */
  splitRequest?: NombaSplitRequest;
  /** Optional: arbitrary key-value metadata attached to the order */
  orderMetaData?: Record<string, string>;
}

// ============================================================
// TOKEN CACHE (in-memory singleton)
// ============================================================

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix timestamp (ms)

// ============================================================
// SERVICE CLASS
// ============================================================

class NombaService {
  private client: AxiosInstance;
  private isSandbox: boolean;

  constructor() {
    this.isSandbox = env.NOMBA_BASE_URL.includes("sandbox");

    this.client = axios.create({
      baseURL: env.NOMBA_BASE_URL,
      timeout: 30000, // 30 seconds
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor: log outgoing requests and their payloads
    this.client.interceptors.request.use((config) => {
      logger.info(
        {
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          data: config.data,
        },
        "Nomba API request payload"
      );
      return config;
    });

    // Response interceptor: log responses and their payloads
    this.client.interceptors.response.use(
      (response) => {
        logger.info(
          {
            status: response.status,
            url: response.config.url,
            data: response.data,
          },
          "Nomba API response payload"
        );
        return response;
      },
      (error: AxiosError) => {
        logger.error(
          {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
            message: error.message,
          },
          "Nomba API error"
        );
        throw error;
      }
    );
  }

  // ============================================================
  // TOKEN MANAGEMENT
  // Per AGENTS.md §2.3: "Access tokens expire in 30 minutes."
  // ============================================================

  /**
   * Obtain a new access token using client credentials.
   * POST /v1/auth/token/issue
   * Header: accountId (parent account ID)
   */
  async obtainAccessToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    if (!env.NOMBA_CLIENT_ID || !env.NOMBA_CLIENT_SECRET) {
      throw new Error(
        "Nomba credentials not configured. Set NOMBA_CLIENT_ID and NOMBA_CLIENT_SECRET in .env"
      );
    }

    const response = await this.client.post<NombaTokenResponse>(
      "/v1/auth/token/issue",
      {
        grant_type: "client_credentials",
        client_id: env.NOMBA_CLIENT_ID,
        client_secret: env.NOMBA_CLIENT_SECRET,
      },
      {
        headers: {
          accountId: env.NOMBA_ACCOUNT_ID,
        },
      }
    );

    let { access_token, refresh_token, expires_in } = response.data.data;
    expires_in = expires_in || 1800; // Fallback to 30 mins if not provided

    // Cache the token
    cachedAccessToken = access_token;
    cachedRefreshToken = refresh_token;
    // Set expiry 60 seconds before actual expiry for safety margin
    tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;

    logger.info(
      { expiresIn: expires_in },
      "Nomba access token obtained successfully"
    );

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    };
  }

  /**
   * Refresh an existing access token using the refresh token.
   * POST /v1/auth/token/refresh
   * Header: accountId (parent account ID)
   */
  async refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    if (!cachedRefreshToken) {
      logger.warn("No refresh token available, obtaining new token");
      return this.obtainAccessToken();
    }

    try {
      const response = await this.client.post<NombaTokenResponse>(
        "/v1/auth/token/refresh",
        {
          grant_type: "refresh_token",
          refresh_token: cachedRefreshToken,
        },
        {
          headers: {
            accountId: env.NOMBA_ACCOUNT_ID,
          },
        }
      );

      let { access_token, refresh_token, expires_in } = response.data.data;
      expires_in = expires_in || 1800;

      // Update cache
      cachedAccessToken = access_token;
      cachedRefreshToken = refresh_token;
      tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;

      logger.info(
        { expiresIn: expires_in },
        "Nomba access token refreshed successfully"
      );

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown" },
        "Token refresh failed, obtaining new token"
      );
      return this.obtainAccessToken();
    }
  }

  /**
   * Get a valid access token. Returns cached token if still valid,
   * otherwise refreshes or obtains a new one.
   *
   * Per AGENTS.md §2.3: "We must cache this token and use
   * jobs/tokenRefresh.ts to refresh it every 25 minutes."
   */
  async getValidToken(): Promise<string> {
    if (cachedAccessToken && Date.now() < tokenExpiresAt) {
      return cachedAccessToken;
    }

    if (cachedRefreshToken) {
      const result = await this.refreshAccessToken();
      return result.accessToken;
    }

    const result = await this.obtainAccessToken();
    return result.accessToken;
  }

  /**
   * Build authorization headers for authenticated Nomba API calls.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getValidToken();
    return {
      Authorization: `Bearer ${token}`,
      accountId: env.NOMBA_ACCOUNT_ID,
    };
  }

  // ============================================================
  // CHECKOUT (First Payment + Card Tokenization)
  // Per AGENTS.md §2.1: Sandbox uses /sandbox/checkout/order
  // ============================================================

  /**
   * Create a checkout order for initial subscription payment.
   *
   * CRITICAL: Per AGENTS.md §2.1:
   * - Sandbox: POST /sandbox/checkout/order
   * - Production: POST /v1/checkout/order
   *
   * @param params - Checkout parameters (amount in KOBO, we convert to NGN)
   */
  async createCheckoutOrder(
    params: CreateCheckoutParams
  ): Promise<{ orderReference: string; checkoutLink: string }> {
    const authHeaders = await this.getAuthHeaders();

    // Convert KOBO (integer) to NGN decimal string for Nomba
    // e.g., 500000 kobo → "5000.00"
    const amountInNaira = (params.amount / 100).toFixed(2);

    // The sandbox probe proved that /sandbox/checkout/order returns a 404, 
    // while /v1/checkout/order works perfectly in sandbox when the base URL is sandbox.nomba.com
    const checkoutPath = "/v1/checkout/order";

    // Build the order object — only include optional fields when provided
    const orderPayload: Record<string, unknown> = {
      orderReference: params.orderReference,
      amount: amountInNaira,
      currency: params.currency ?? "NGN",
      customerEmail: params.customerEmail,
      callbackUrl: params.callbackUrl,
      // Use explicit customerId if given, otherwise fall back to orderReference
      customerId: params.customerId ?? params.orderReference,
    };

    // Destination sub-account (where funds are deposited).
    // Per Nomba rules: body accountId = sub-account (deposit destination), NOT the parent.
    // The parent accountId is always in the Authorization header via getAuthHeaders().
    // Default to NOMBA_SUB_ACCOUNT_ID so callers don't need to remember to pass it.
    orderPayload.accountId = params.accountId ?? env.NOMBA_SUB_ACCOUNT_ID;

    // Restrict which payment methods appear on the checkout page
    if (params.allowedPaymentMethods && params.allowedPaymentMethods.length > 0) {
      orderPayload.allowedPaymentMethods = params.allowedPaymentMethods;
    }

    // Split the inflow across multiple accounts
    if (params.splitRequest) {
      orderPayload.splitRequest = params.splitRequest;
    }

    // Arbitrary metadata (supports the special { region: "CD" } DRC key)
    if (params.orderMetaData && Object.keys(params.orderMetaData).length > 0) {
      orderPayload.orderMetaData = params.orderMetaData;
    }

    const response = await this.client.post<NombaCheckoutOrderResponse>(
      checkoutPath,
      {
        order: {
          orderReference: params.orderReference,
          customerId: params.orderReference, // Use order ref as customer identifier
          amount: amountInNaira,
          currency: params.currency || "NGN",
          customerEmail: params.customerEmail,
          callbackUrl: params.callbackUrl,
          accountId: env.NOMBA_SUB_ACCOUNT_ID,
        },
        tokenizeCard: params.tokenizeCard ?? true,
      },
      { headers: authHeaders }
    );

    const responseData = response.data as any;
    if (!responseData || !responseData.data || !responseData.data.orderReference) {
      const errorMsg = responseData?.description || `Nomba checkout failed with HTTP status ${response.status}`;
      throw new Error(errorMsg);
    }

    logger.info(
      {
        orderReference: responseData.data.orderReference,
        path: checkoutPath,
        hasMetaData: !!params.orderMetaData,
        hasSplit: !!params.splitRequest,
        paymentMethods: params.allowedPaymentMethods,
      },
      "Nomba checkout order created"
    );

    return {
      orderReference: response.data.data.orderReference,
      checkoutLink: response.data.data.checkoutLink,
    };
  }

  // ============================================================
  // GET CHECKOUT ORDER DETAILS
  // Per Nomba API: GET /v1/checkout/order/{orderReference}
  // ============================================================

  /**
   * Fetch a single checkout order by its orderReference.
   *
   * Used to:
   * 1. Verify order status from the FlexCharge invoice dashboard
   * 2. Surface Nomba business/customer metadata alongside our invoice record
   * 3. Expose hasSavedCards & RSA public key for advanced card-on-file flows
   *
   * @param orderReference - The Nomba-generated order reference UUID
   */
  async getCheckoutOrder(orderReference: string): Promise<{
    order: {
      orderId: string;
      orderReference: string;
      customerId: string;
      accountId: string;
      callbackUrl: string;
      customerEmail: string;
      amount: string;
      currency: string;
      businessName: string;
      businessEmail: string;
      businessLogo: string;
    };
    hasSavedCards: boolean;
    base64EncodedRsaPublicKey: string;
  }> {
    const authHeaders = await this.getAuthHeaders();

    const response = await this.client.get<NombaCheckoutOrderDetailsResponse>(
      `/v1/checkout/order/${encodeURIComponent(orderReference)}`,
      { headers: authHeaders }
    );

    const { code, description, data } = response.data;

    if (code !== "00") {
      throw new Error(
        `Nomba getCheckoutOrder failed [${code}]: ${description}`
      );
    }

    logger.info(
      {
        orderReference,
        orderId: data.order.orderId,
        amount: data.order.amount,
        currency: data.order.currency,
        hasSavedCards: data.hasSavedCards,
      },
      "Nomba checkout order details fetched"
    );

    return {
      order: data.order,
      hasSavedCards: data.hasSavedCards,
      base64EncodedRsaPublicKey: data.base64EncodedRsaPublicKey,
    };
  }

  // ============================================================
  // TOKENIZED CARD CHARGE (Recurring Billing)
  // Per AGENTS.md §2.1: POST /v1/checkout/tokenized-card-payment
  // ============================================================

  /**
   * Charge a previously tokenized card for recurring billing.
   *
   * Per AGENTS.md §2.1: Both sandbox and production use
   * POST /v1/checkout/tokenized-card-payment
   *
   * @param params - Charge parameters (amount in KOBO, we convert to NGN)
   */
  async chargeTokenizedCard(
    params: ChargeTokenizedCardParams
  ): Promise<{
    /**
     * True when Nomba's outer `code === "00"` AND `data.status` is truthy.
     * This is the canonical success indicator to check in the billing engine.
     * DO NOT check for string values like "SUCCESS" or "APPROVED" — Nomba
     * returns a boolean (or boolean string) for this endpoint.
     */
    success: boolean;
    message: string;
  }> {
    const authHeaders = await this.getAuthHeaders();

    // Convert KOBO (integer) to Naira decimal string for Nomba
    // e.g., 500000 kobo → "5000.00"
    const amountInNaira = (params.amount / 100).toFixed(2);

    // Build the order object — callbackUrl is required by Nomba when sending order.
    // For server-side recurring charges there is no customer redirect, so we
    // fall back to the frontend URL as a safe no-op callback.
    const orderPayload: Record<string, unknown> = {
      orderReference: params.orderReference,
      amount: amountInNaira,
      currency: params.currency ?? "NGN",
      customerEmail: params.customerEmail,
      customerId: params.customerId ?? params.orderReference,
      accountId: params.accountId ?? env.NOMBA_SUB_ACCOUNT_ID,
      // Required per Nomba docs when the order object is present
      callbackUrl: params.callbackUrl ?? `${env.FRONTEND_URL}/billing/complete`,
    };

    // Conditionally include optional fields — omit when absent to keep payload lean
    if (params.allowedPaymentMethods && params.allowedPaymentMethods.length > 0) {
      orderPayload.allowedPaymentMethods = params.allowedPaymentMethods;
    }
    if (params.splitRequest) {
      orderPayload.splitRequest = params.splitRequest;
    }
    if (params.orderMetaData && Object.keys(params.orderMetaData).length > 0) {
      orderPayload.orderMetaData = params.orderMetaData;
    }

    const response = await this.client.post<NombaTokenizedChargeResponse>(
      "/v1/checkout/tokenized-card-payment",
      {
        tokenKey: params.tokenKey,
        order: orderPayload,
      },
      { headers: authHeaders }
    );

    const { code, description, data } = response.data;

    // Primary success gate: Nomba outer response code must be "00"
    const outerSuccess = code === "00";

    // Normalise data.status — Nomba docs show boolean but field may arrive as
    // string "true"/"false" depending on SDK version. Handle both defensively.
    const statusRaw = data.status;
    const innerSuccess =
      statusRaw === true ||
      statusRaw === "true" ||
      (typeof statusRaw === "string" && statusRaw.toLowerCase() === "true");

    const success = outerSuccess && innerSuccess;
    const message = data.message ?? description ?? (success ? "success" : "failed");

    logger.info(
      {
        orderReference: params.orderReference,
        tokenKey: params.tokenKey,
        outerCode: code,
        innerStatus: statusRaw,
        success,
        message,
        amountNaira: amountInNaira,
        currency: params.currency ?? "NGN",
      },
      "Nomba tokenized card charge completed"
    );

    return { success, message };
  }

  // ============================================================
  // TRANSACTION VERIFICATION (Sub-Account Scoped)
  // Per AGENTS.md §2.2: Must use sub-account endpoint
  // ============================================================

  /**
   * Verify a transaction's status using the sub-account endpoint.
   *
   * CRITICAL: Per AGENTS.md §2.2:
   * "We must call the sub-account status checker:
   *  GET /v1/transactions/accounts/{subAccountId}/single"
   *
   * @param orderReference - The order reference to verify
   */
  async verifyTransaction(orderReference: string): Promise<{
    status: string;
    transactionId?: string;
    transactionRef?: string;
    tokenizedCardData?: {
      tokenKey: string;
      cardLast4: string;
      cardBrand: string;
    };
  }> {
    const authHeaders = await this.getAuthHeaders();

    // Per AGENTS.md §2.2: Sub-account scoped verification
    const subAccountId = env.NOMBA_SUB_ACCOUNT_ID;

    const response = await this.client.get<NombaTransactionStatusResponse>(
      `/v1/transactions/accounts/${subAccountId}/single`,
      {
        params: { orderReference },
        headers: authHeaders,
      }
    );

    logger.info(
      {
        orderReference,
        status: response.data.data.status,
        transactionId: response.data.data.transactionId,
      },
      "Nomba transaction verification completed"
    );

    return {
      status: response.data.data.status,
      transactionId: response.data.data.transactionId,
      transactionRef: response.data.data.transactionRef,
      tokenizedCardData: response.data.data.tokenizedCardData,
    };
  }

  // ============================================================
  // FETCH CHECKOUT TRANSACTION
  // Per Nomba API: GET /v1/checkout/transaction
  // ============================================================

  /**
   * Fetch the live status and full details of a checkout transaction.
   *
   * This is the dedicated checkout transaction status endpoint.
   * It supports two query modes via the `idType` parameter:
   *   - ORDER_REFERENCE: uses the merchant-supplied reference string
   *   - ORDER_ID:        uses the UUID returned by Nomba when the order was created
   *
   * NOTE: This is DIFFERENT from `verifyTransaction()` which queries the
   * sub-account Transactions ledger API for internal billing reconciliation.
   * Use THIS method when you want the full checkout transaction breakdown
   * (card details, transfer details, tokenization status) from the checkout flow.
   *
   * @param id     - The ORDER_ID or ORDER_REFERENCE value
   * @param idType - Which id type to use (defaults to ORDER_REFERENCE)
   */
  async fetchCheckoutTransaction(
    id: string,
    idType: "ORDER_ID" | "ORDER_REFERENCE" = "ORDER_REFERENCE"
  ): Promise<{
    success: boolean;
    message: string;
    order: {
      orderId: string;
      orderReference: string;
      customerId: string;
      accountId: string;
      callbackUrl: string;
      customerEmail: string;
      amount: string;
      currency: string;
    };
    transactionDetails?: {
      transactionDate: string;
      paymentReference: string;
      paymentVendorReference: string;
      tokenizedCardPayment: boolean;
      statusCode: string;
    };
    transferDetails?: {
      sessionId: string;
      beneficiaryAccountName: string;
      beneficiaryAccountNumber: string;
      originatorAccountName: string;
      originatorAccountNumber: string;
      narration: string;
      destinationInstitutionCode: string;
      paymentReference: string;
    };
    cardDetails?: {
      cardPan: string;
      cardType: string;
      cardCurrency: string;
      cardBank: string;
    };
  }> {
    const authHeaders = await this.getAuthHeaders();

    const response = await this.client.get<NombaCheckoutTransactionResponse>(
      "/v1/checkout/transaction",
      {
        params: { idType, id },
        headers: authHeaders,
      }
    );

    const { code, description, data } = response.data;

    if (code !== "00") {
      throw new Error(
        `Nomba fetchCheckoutTransaction failed [${code}]: ${description}`
      );
    }

    logger.info(
      {
        id,
        idType,
        success: data.success,
        message: data.message,
        orderId: data.order.orderId,
        orderReference: data.order.orderReference,
        hasCardDetails: !!data.cardDetails,
        hasTransferDetails: !!data.transferDetails,
        tokenizedCardPayment: data.transactionDetails?.tokenizedCardPayment,
      },
      "Nomba checkout transaction fetched"
    );

    return {
      success: data.success,
      message: data.message,
      order: data.order,
      transactionDetails: data.transactionDetails,
      transferDetails: data.transferDetails,
      cardDetails: data.cardDetails,
    };
  }

  // ============================================================
  // TRANSFERS & REFUNDS (Ledger / Withdrawal)
  // ============================================================

  /**
   * Verify a bank account's name before a transfer.
   * POST /v1/transfers/bank/lookup
   */
  async lookupBankAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string }> {
    const authHeaders = await this.getAuthHeaders();
    const response = await this.client.post(
      `/v1/transfers/bank/lookup`,
      { bankCode, accountNumber },
      { headers: authHeaders }
    );
    
    logger.info({ bankCode, accountNumber }, "Nomba bank account lookup completed");
    return { accountName: response.data.data.accountName };
  }

  /**
   * Initiate a payout from our Nomba master account.
   * POST /v2/transfers/bank
   * 
   * @param amount - Transfer amount in KOBO
   */
  async transferToBank(params: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    merchantTxRef: string;
    senderName: string;
    narration: string;
  }): Promise<{ status: string; transferId: string }> {
    const authHeaders = await this.getAuthHeaders();
    const amountInNaira = (params.amount / 100).toFixed(2);

    const response = await this.client.post(
      `/v2/transfers/bank`,
      {
        amount: amountInNaira,
        accountNumber: params.accountNumber,
        accountName: params.accountName,
        bankCode: params.bankCode,
        merchantTxRef: params.merchantTxRef,
        senderName: params.senderName,
        narration: params.narration,
      },
      { headers: authHeaders }
    );

    logger.info(
      { merchantTxRef: params.merchantTxRef, amount: amountInNaira, accountNumber: params.accountNumber },
      "Nomba bank transfer initiated"
    );

    return {
      status: response.data.data?.status || "SUCCESS",
      transferId: response.data.data?.id || params.merchantTxRef,
    };
  }

  /**
   * Refund a completed checkout transaction.
   * POST /v1/checkout/refund
   * 
   * @param amount - Refund amount in KOBO
   */
  async refundCheckoutOrder(params: {
    transactionId: string;
    amount: number;
    accountNumber: string;
    bankCode: string;
  }): Promise<{ status: string }> {
    const authHeaders = await this.getAuthHeaders();
    const amountInNaira = (params.amount / 100).toFixed(2);

    const response = await this.client.post(
      `/v1/checkout/refund`,
      {
        transactionId: params.transactionId,
        amount: amountInNaira,
        accountNumber: params.accountNumber,
        bankCode: params.bankCode,
      },
      { headers: authHeaders }
    );

    const { code, description, data } = response.data;

    // Check Nomba's custom success codes (typically "00" or "200")
    if (code !== "00" && code !== "200" && code !== "000") {
      throw new Error(description || `Nomba refund rejected with code: ${code}`);
    }

    logger.info(
      { transactionId: params.transactionId, amount: amountInNaira },
      "Nomba checkout order refunded"
    );

    return { status: data?.status || "SUCCESS" };
  }

  // ============================================================
  // TOKENIZED CARD MANAGEMENT
  // Online Checkout: GET    /v1/checkout/tokenized-card-data
  //                  POST   /v1/checkout/tokenized-card-data
  //                  DELETE /v1/checkout/tokenized-card-data
  // Charge:          GET    /v1/checkout/user-card/{orderReference}
  // ============================================================

  /**
   * List all of the merchant's tokenized cards.
   *
   * Per Nomba API: GET /v1/checkout/tokenized-card-data
   * Header: accountId (required — parent account UUID)
   * Query params:
   *   - customerEmail: filter by customer email
   *   - startDate:     ISO date string, start of creation window
   *   - endDate:       ISO date string, end of creation window
   *   - page:          0-indexed page number (omit for first page)
   *
   * @returns Paginated list of tokenized card records + nextPage cursor
   */
  async listTokenizedCards(params?: {
    customerEmail?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
  }): Promise<{
    nextPage: string;
    tokenizedCardDataList: NombaTokenizedCardItem[];
    total: number;
  }> {
    const authHeaders = await this.getAuthHeaders();

    // Build query params — only include keys that were provided
    const queryParams: Record<string, string | number> = {};
    if (params?.customerEmail) queryParams.customerEmail = params.customerEmail;
    if (params?.startDate)     queryParams.startDate = params.startDate;
    if (params?.endDate)       queryParams.endDate = params.endDate;
    if (params?.page !== undefined) queryParams.page = params.page;

    const response = await this.client.get<NombaListTokenizedCardsResponse>(
      "/v1/checkout/tokenized-card-data",
      {
        headers: authHeaders,
        params: queryParams,
      }
    );

    const { code, description, data } = response.data;

    if (code !== "00") {
      throw new Error(
        `Nomba listTokenizedCards failed: [${code}] ${description}`
      );
    }

    const list = data.tokenizedCardDataList ?? [];

    logger.info(
      {
        count: list.length,
        nextPage: data.nextPage,
        filters: params ?? {},
      },
      "Nomba tokenized card list fetched"
    );

    return {
      nextPage: data.nextPage ?? "0",
      tokenizedCardDataList: list,
      total: list.length,
    };
  }

  // ============================================================
  // UPDATE TOKENIZED CARD
  // Online Checkout: POST /v1/checkout/tokenized-card-data
  // ============================================================

  /**
   * Update the email address associated with a tokenized card.
   *
   * Per Nomba API: POST /v1/checkout/tokenized-card-data
   * Header: accountId (required — parent account UUID)
   *
   * Use this to reassign a stored card token to a new customer email
   * address (e.g. after an email change in the merchant's own system).
   * Nomba validates that `currentEmailAddress` matches the email on
   * record for `tokenKey` before applying the update.
   *
   * @param tokenKey            - The token key returned by Nomba's tokenization webhook
   * @param currentEmailAddress - Email address currently associated with the token
   * @param newEmailAddress     - New email address to map the token to
   * @returns Updated status plus the full updated tokenizedCardData array
   */
  async updateTokenizedCard(params: {
    tokenKey: string;
    currentEmailAddress: string;
    newEmailAddress: string;
  }): Promise<{
    status: boolean;
    message: string;
    tokenizedCardData: NombaTokenizedCardItem[];
  }> {
    if (!params.tokenKey?.trim()) {
      throw new Error("updateTokenizedCard: tokenKey is required");
    }
    if (!params.currentEmailAddress?.trim()) {
      throw new Error("updateTokenizedCard: currentEmailAddress is required");
    }
    if (!params.newEmailAddress?.trim()) {
      throw new Error("updateTokenizedCard: newEmailAddress is required");
    }

    const authHeaders = await this.getAuthHeaders();

    const response = await this.client.post<{
      code: string;
      description: string;
      data: {
        status: string | boolean;
        message: string;
        tokenizedCardData: NombaTokenizedCardItem[];
      };
    }>(
      "/v1/checkout/tokenized-card-data",
      {
        tokenKey:            params.tokenKey,
        currentEmailAddress: params.currentEmailAddress,
        newEmailAddress:     params.newEmailAddress,
      },
      { headers: authHeaders }
    );

    const { code, description, data } = response.data;

    if (code !== "00") {
      throw new Error(
        `Nomba updateTokenizedCard failed: [${code}] ${description}`
      );
    }

    // Nomba returns status as string "true"/"false" — normalize to boolean
    const status = data.status === true || data.status === "true";
    const cards  = data.tokenizedCardData ?? [];

    logger.info(
      {
        tokenKey:        params.tokenKey,
        newEmailAddress: params.newEmailAddress,
        status,
        cardCount:       cards.length,
      },
      "Nomba tokenized card updated"
    );

    return {
      status,
      message:           data.message,
      tokenizedCardData: cards,
    };
  }

  // ============================================================
  // DELETE TOKENIZED CARD
  // Online Checkout: DELETE /v1/checkout/tokenized-card-data
  // ============================================================

  /**
   * Permanently delete a tokenized card from Nomba's vault.
   *
   * Per Nomba API: DELETE /v1/checkout/tokenized-card-data
   * Header: accountId (required — parent account UUID)
   *
   * Once deleted, the `tokenKey` can no longer be used for charging.
   * This should be called when:
   *   - A customer requests card removal from the merchant's app
   *   - A card has expired and you want to clean up stale records
   *   - Regulatory/compliance requires PII purging
   *
   * NOTE: Nomba's DELETE endpoint accepts a JSON body (tokenKey).
   * Axios sends body data for DELETE via the `data` config key.
   *
   * @param tokenKey - The token key of the card to permanently delete
   * @returns { status: boolean, message: string }
   */
  async deleteTokenizedCard(tokenKey: string): Promise<{
    status: boolean;
    message: string;
  }> {
    if (!tokenKey?.trim()) {
      throw new Error("deleteTokenizedCard: tokenKey is required");
    }

    const authHeaders = await this.getAuthHeaders();

    const response = await this.client.delete<{
      code: string;
      description: string;
      data: {
        status: string | boolean;
        message: string;
      };
    }>(
      "/v1/checkout/tokenized-card-data",
      {
        headers: authHeaders,
        // Axios requires body data on DELETE requests to be passed via `data`
        data: { tokenKey },
      }
    );

    const { code, description, data } = response.data;

    if (code !== "00") {
      throw new Error(
        `Nomba deleteTokenizedCard failed: [${code}] ${description}`
      );
    }

    // Nomba returns status as string "true" — normalize to real boolean
    const status = data.status === true || data.status === "true";

    logger.info(
      { tokenKey, status },
      "Nomba tokenized card deleted"
    );

    return { status, message: data.message };
  }

  // UTILITY — for testing and health checks
  // ============================================================

  /**
   * Check if Nomba credentials are configured.
   */
  isConfigured(): boolean {
    return !!(env.NOMBA_CLIENT_ID && env.NOMBA_CLIENT_SECRET);
  }

  /**
   * Check if the service is currently authenticated (has a valid cached token).
   */
  isAuthenticated(): boolean {
    return !!(cachedAccessToken && Date.now() < tokenExpiresAt);
  }

  /**
   * Clear the cached tokens. Useful for testing.
   */
  clearTokenCache(): void {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    tokenExpiresAt = 0;
  }
}

// Export a singleton instance
export const nombaService = new NombaService();
