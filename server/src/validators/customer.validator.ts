import { z } from "zod";

/**
 * Zod validation schemas for Customer endpoints.
 */

export const createCustomerSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  name: z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(100, "Name cannot exceed 100 characters")
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, "Phone number cannot exceed 20 characters")
    .trim()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20)
    .trim()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Pagination and filtering query schema.
 * Used by list endpoints to support paginated responses.
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .default("20")
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
