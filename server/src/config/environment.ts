import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Environment variable schema.
 * The server will crash immediately on startup if any required
 * variable is missing or has the wrong type. This is intentional —
 * we want to fail loudly rather than silently misbehave in production.
 */
const envSchema = z.object({
  PORT: z
    .string()
    .default("7000")
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // MongoDB
  MONGO_URL: z.string().min(1, "MONGO_URL is required"),

  // Tenant JWT auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("24h"),

  // Customer Portal JWT auth
  PORTAL_JWT_SECRET: z
    .string()
    .min(16, "PORTAL_JWT_SECRET must be at least 16 characters"),
  PORTAL_JWT_EXPIRES_IN: z.string().default("1h"),

  // App
  API_BASE_URL: z.string().url().default("http://localhost:7000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Nomba API (Sandbox)
  // Per AGENTS.md §1: Sandbox base URL and account IDs
  // Per AGENTS.md §2: Token lifecycle management
  NOMBA_BASE_URL: z.string().url().default("https://sandbox.nomba.com"),
  NOMBA_CLIENT_ID: z.string().default(""),
  NOMBA_CLIENT_SECRET: z.string().default(""),
  NOMBA_ACCOUNT_ID: z.string().default("f666ef9b-888e-4799-85ce-acb505b28023"),
  NOMBA_SUB_ACCOUNT_ID: z.string().default("5102a72b-3dac-42d0-a549-3094ad0c36ea"),
  NOMBA_WEBHOOK_SECRET: z.string().optional().default("NombaHackathon2026"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  );
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
