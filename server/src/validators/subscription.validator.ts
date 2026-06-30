import { z } from "zod";
import { PLAN_INTERVALS, SUBSCRIPTION_STATUSES } from "../types/subscription.types.js";

/**
 * Zod validation schemas for Subscription endpoints.
 *
 * All amounts referenced here are in KOBO (integers).
 * Per AGENTS.md §3: "All financial values must be handled in KOBO (integers only)."
 */

/**
 * Schema for POST /subscriptions — create a new subscription.
 * The subscription starts in "pending" status and a Nomba checkout link
 * is generated for the customer to complete payment.
 */
export const createSubscriptionSchema = z.object({
  customerId: z
    .string()
    .min(1, "Customer ID is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid Customer ID format"),
  planId: z
    .string()
    .min(1, "Plan ID is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid Plan ID format"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for POST /subscriptions/:id/cancel — cancel a subscription.
 */
export const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z
    .boolean()
    .default(true),
  cancellationReason: z
    .string()
    .max(500, "Cancellation reason cannot exceed 500 characters")
    .trim()
    .optional(),
});

/**
 * Schema for POST /subscriptions/:id/change-plan — upgrade/downgrade.
 */
export const changePlanSchema = z.object({
  newPlanId: z
    .string()
    .min(1, "New Plan ID is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid Plan ID format"),
});

/**
 * Schema for POST /subscriptions/:id/simulate-change — proration dry-run.
 * Same shape as changePlanSchema but used for read-only previews.
 */
export const simulateChangePlanSchema = z.object({
  newPlanId: z
    .string()
    .min(1, "New Plan ID is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid Plan ID format"),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type SimulateChangePlanInput = z.infer<typeof simulateChangePlanSchema>;
