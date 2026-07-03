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

interface NombaTokenizedChargeResponse {
  code: string;
  description: string;
  data: {
    status: string;
    transactionId?: string;
    message?: string;
    code?: string; // Decline code for failed charges
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

export interface CreateCheckoutParams {
  orderReference: string;
  amount: number;         // In KOBO — we convert to NGN string for Nomba
  currency?: string;
  customerEmail: string;
  callbackUrl: string;
  tokenizeCard?: boolean;
}

export interface ChargeTokenizedCardParams {
  tokenKey: string;
  orderReference: string;
  amount: number;         // In KOBO — we convert to NGN string for Nomba
  currency?: string;
  customerEmail: string;
  customerId?: string;
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

    // Request interceptor: log outgoing requests
    this.client.interceptors.request.use((config) => {
      logger.debug(
        {
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
        },
        "Nomba API request"
      );
      return config;
    });

    // Response interceptor: log responses
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          {
            status: response.status,
            url: response.config.url,
            code: response.data?.code,
          },
          "Nomba API response"
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

    logger.info(
      {
        orderReference: response.data.data.orderReference,
        path: checkoutPath,
      },
      "Nomba checkout order created"
    );

    return {
      orderReference: response.data.data.orderReference,
      checkoutLink: response.data.data.checkoutLink,
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
    status: string;
    transactionId?: string;
    declineCode?: string;
    message?: string;
  }> {
    const authHeaders = await this.getAuthHeaders();

    // Convert KOBO to NGN decimal string
    const amountInNaira = (params.amount / 100).toFixed(2);

    const response = await this.client.post<NombaTokenizedChargeResponse>(
      "/v1/checkout/tokenized-card-payment",
      {
        tokenKey: params.tokenKey,
        order: {
          orderReference: params.orderReference,
          amount: amountInNaira,
          currency: params.currency || "NGN",
          customerEmail: params.customerEmail,
          customerId: params.customerId || params.orderReference,
          accountId: env.NOMBA_SUB_ACCOUNT_ID,
        },
      },
      { headers: authHeaders }
    );

    logger.info(
      {
        orderReference: params.orderReference,
        status: response.data.data.status,
      },
      "Nomba tokenized card charge completed"
    );

    return {
      status: response.data.data.status,
      transactionId: response.data.data.transactionId,
      declineCode: response.data.data.code,
      message: response.data.data.message,
    };
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
