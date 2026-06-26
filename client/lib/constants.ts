const getApiBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  url = url.replace(/\/$/, ""); // Remove trailing slash
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  return url;
};

export const API_BASE_URL = getApiBaseUrl();

export const TOKEN_KEY = "fc_token";

export const USER_KEY = "fc_user";

export const BILLING_INTERVALS = ["monthly", "yearly", "weekly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DEFAULT_CURRENCY = "NGN";

export const PAGE_SIZE = 20;
