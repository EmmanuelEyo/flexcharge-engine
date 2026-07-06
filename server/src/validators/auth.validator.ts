import { z } from "zod";

/**
 * Zod validation schemas for authentication endpoints.
 */

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Password is required"),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Key name is required")
    .max(50, "Key name cannot exceed 50 characters")
    .trim()
    .default("Default Key"),
});

export const updateWebhookSchema = z.object({
  webhookUrl: z
    .string()
    .trim()
    .refine(
      (val) => val === "" || z.string().url().safeParse(val).success,
      { message: "Invalid webhook URL" }
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updatePayoutSettingsSchema = z.object({
  payoutSchedule: z.enum(["daily", "weekly", "monthly"]),
  payoutThreshold: z.number().min(0, "Threshold must be non-negative"),
  payoutDayOfWeek: z.number().min(1).max(7).optional(),
  payoutDayOfMonth: z.number().min(1).max(31).optional(),
});
export type UpdatePayoutSettingsInput = z.infer<typeof updatePayoutSettingsSchema>;
