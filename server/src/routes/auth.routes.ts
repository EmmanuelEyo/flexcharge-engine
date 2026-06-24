import { Router } from "express";
import {
  register,
  login,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateWebhookUrl,
  getWebhookSecret,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { authenticateJWT } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  createApiKeySchema,
  updateWebhookSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

/**
 * Auth Routes
 *
 * Public:
 *   POST /auth/register    — Create a new tenant account
 *   POST /auth/login       — Login and receive JWT
 *
 * Protected (JWT required):
 *   POST   /auth/api-keys        — Generate a new API key
 *   GET    /auth/api-keys        — List all API keys
 *   DELETE /auth/api-keys/:id    — Revoke an API key
 *   PATCH  /auth/webhook         — Update webhook URL
 *   GET    /auth/webhook-secret  — Retrieve webhook signing secret
 *   GET    /auth/me              — Get current tenant profile
 *   POST   /auth/change-password — Change password
 *   POST   /auth/forgot-password — Request password reset
 *   POST   /auth/reset-password  — Reset password
 */

// Public routes (rate-limited to prevent brute force)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

// Protected routes (require JWT session)
router.get("/me", authenticateJWT, getMe);
router.post("/change-password", authenticateJWT, validate(changePasswordSchema), changePassword);
router.post(
  "/api-keys",
  authenticateJWT,
  validate(createApiKeySchema),
  createApiKey
);
router.get("/api-keys", authenticateJWT, listApiKeys);
router.delete("/api-keys/:id", authenticateJWT, revokeApiKey);

// Webhook configuration
router.patch(
  "/webhook",
  authenticateJWT,
  validate(updateWebhookSchema),
  updateWebhookUrl
);
router.get("/webhook-secret", authenticateJWT, getWebhookSecret);

export default router;
