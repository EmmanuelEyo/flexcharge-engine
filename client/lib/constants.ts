export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export const TOKEN_KEY = "fc_token";

export const USER_KEY = "fc_user";

export const BILLING_INTERVALS = ["monthly", "yearly", "weekly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DEFAULT_CURRENCY = "NGN";

export const PAGE_SIZE = 20;
