/**
 * Subscription status state machine.
 *
 * Valid transitions:
 *   pending   → trialing | active | canceled
 *   trialing  → active | canceled
 *   active    → past_due | paused | canceled
 *   past_due  → active | unpaid | canceled
 *   paused    → active | canceled
 *   unpaid    → active | canceled
 *   canceled  → (terminal state)
 */
export const SUBSCRIPTION_STATUSES = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Invoice statuses
 */
export const INVOICE_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Plan billing intervals
 */
export const PLAN_INTERVALS = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export type PlanInterval = (typeof PLAN_INTERVALS)[number];

/**
 * Dunning attempt statuses
 */
export const DUNNING_STATUSES = [
  "scheduled",
  "succeeded",
  "failed",
  "skipped",
] as const;

export type DunningStatus = (typeof DUNNING_STATUSES)[number];

/**
 * Webhook delivery statuses
 */
export const WEBHOOK_DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "failed",
] as const;

export type WebhookDeliveryStatus =
  (typeof WEBHOOK_DELIVERY_STATUSES)[number];

/**
 * Events that FlexCharge emits to downstream tenants.
 */
export const WEBHOOK_EVENTS = [
  "subscription.created",
  "subscription.renewed",
  "subscription.updated",
  "subscription.payment_failed",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.unpaid",
  "invoice.paid",
  "invoice.failed",
  "customer.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Maps a plan interval to the number of days in that interval.
 * Used by the billing engine to calculate nextBillingDate.
 */
export const INTERVAL_DAYS: Record<PlanInterval, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};
