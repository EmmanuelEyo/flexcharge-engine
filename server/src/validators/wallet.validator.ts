import { z } from "zod";

/**
 * Zod validation schemas for Wallet endpoints.
 *
 * All amounts referenced here are in KOBO (integers).
 * Per AGENTS.md §3: "All financial values must be handled in KOBO (integers only)."
 */

export const createWalletSchema = z.object({
  customerId: z
    .string()
    .min(1, "Customer ID is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid Customer ID format"),
  subscriptionId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid Subscription ID format")
    .optional(),
});

export const topUpWalletSchema = z.object({
  amount: z
    .number()
    .int("Amount must be an integer (kobo)")
    .positive("Amount must be a positive number"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  referenceId: z.string().optional(),
});

export const debitWalletSchema = z.object({
  amount: z
    .number()
    .int("Amount must be an integer (kobo)")
    .positive("Amount must be a positive number"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  referenceId: z.string().optional(),
});

export const updateAutoTopUpSchema = z.object({
  minAutoTopUpAmount: z
    .number()
    .int("Amount must be an integer (kobo)")
    .nonnegative("Amount cannot be negative")
    .optional(),
  maxAutoTopUpAmount: z
    .number()
    .int("Amount must be an integer (kobo)")
    .nonnegative("Amount cannot be negative")
    .optional(),
  minAutoTopUpTrigger: z
    .number()
    .int("Trigger must be an integer (kobo)")
    .nonnegative("Trigger cannot be negative")
    .optional(),
  maxAutoTopUpTrigger: z
    .number()
    .int("Trigger must be an integer (kobo)")
    .nonnegative("Trigger cannot be negative")
    .optional(),
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type TopUpWalletInput = z.infer<typeof topUpWalletSchema>;
export type DebitWalletInput = z.infer<typeof debitWalletSchema>;
export type UpdateAutoTopUpInput = z.infer<typeof updateAutoTopUpSchema>;
