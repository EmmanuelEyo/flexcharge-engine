import { z } from "zod";
import { PLAN_INTERVALS } from "../types/subscription.types.js";

/**
 * Zod validation schemas for Plan endpoints.
 */

export const createPlanSchema = z.object({
  name: z
    .string()
    .min(2, "Plan name must be at least 2 characters")
    .max(100, "Plan name cannot exceed 100 characters")
    .trim(),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    )
    .max(100)
    .optional(),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .trim()
    .optional(),
  amount: z
    .number()
    .int("Amount must be a whole number (kobo)")
    .min(0, "Amount cannot be negative"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("NGN"),
  interval: z.enum(PLAN_INTERVALS, {
    message: "Interval must be one of: weekly, monthly, quarterly, yearly, custom",
  }),
  intervalDays: z
    .number()
    .int()
    .min(1, "Interval days must be at least 1")
    .optional(),
  trialDays: z
    .number()
    .int()
    .min(0, "Trial days cannot be negative")
    .default(0),
  features: z.array(z.string().trim()).default([]),
  creditsPerCycle: z.number().int().nonnegative().optional(),
  allowMultipleSubscriptions: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.interval === "custom") {
      return data.intervalDays !== undefined && data.intervalDays >= 1;
    }
    return true;
  },
  {
    message: "intervalDays is required and must be at least 1 when interval is 'custom'",
    path: ["intervalDays"],
  }
);

export const updatePlanSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  description: z
    .string()
    .max(500)
    .trim()
    .optional(),
  amount: z
    .number()
    .int("Amount must be a whole number (kobo)")
    .min(0)
    .optional(),
  trialDays: z
    .number()
    .int()
    .min(0)
    .optional(),
  features: z.array(z.string().trim()).optional(),
  creditsPerCycle: z.number().int().nonnegative().optional(),
  allowMultipleSubscriptions: z.boolean().optional(),
  isActive: z.boolean().optional(),
  interval: z.enum(PLAN_INTERVALS, {
    message: "Interval must be one of: weekly, monthly, quarterly, yearly, custom",
  }).optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").optional(),
  intervalDays: z
    .number()
    .int()
    .min(1, "Interval days must be at least 1")
    .optional(),
}).refine(
  (data) => {
    // If they explicitly set interval to "custom", they MUST provide intervalDays
    if (data.interval === "custom" && data.intervalDays === undefined) {
      return false;
    }
    return true;
  },
  {
    message: "intervalDays is required when updating interval to 'custom'",
    path: ["intervalDays"],
  }
);

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
