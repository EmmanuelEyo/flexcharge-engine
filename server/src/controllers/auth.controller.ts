import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Tenant } from "../models/Tenant.js";
import { ApiKey } from "../models/ApiKey.js";
import {
  sendSuccess,
  sendCreated,
  AppError,
  ConflictError,
  UnauthorizedError,
} from "../utils/apiResponse.js";
import { env } from "../config/environment.js";
import { logger } from "../utils/logger.js";
import type {
  RegisterInput,
  LoginInput,
  CreateApiKeyInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdatePayoutSettingsInput,
} from "../validators/auth.validator.js";

/**
 * Auth Controller — handles tenant registration, login, and API key management.
 *
 * Per implementation_plan.md §4 and pre_hackathon_setup_plan.md §2.2
 */

/**
 * POST /auth/register
 * Register a new tenant (downstream business team).
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password } = req.body as RegisterInput;

    // Check if tenant with this email already exists
    const existing = await Tenant.findOne({ email });
    if (existing) {
      throw new ConflictError("A tenant with this email already exists");
    }

    // Create the tenant — password is hashed by the pre-save hook
    const tenant = await Tenant.create({
      name,
      email,
      passwordHash: password, // pre-save hook will bcrypt this
    });

    // Generate JWT session token
    const token = jwt.sign(
      { tenantId: tenant._id.toString() },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    logger.info({ tenantId: tenant._id, email }, "New tenant registered");

    sendCreated(res, {
      tenant: tenant.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/login
 * Authenticate a tenant and return a JWT session token.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;

    // Find tenant by email
    const tenant = await Tenant.findOne({ email, isActive: true });
    if (!tenant) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Compare password
    const isMatch = await tenant.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Generate JWT session token
    const token = jwt.sign(
      { tenantId: tenant._id.toString() },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    logger.info({ tenantId: tenant._id }, "Tenant logged in");

    sendSuccess(res, {
      tenant: tenant.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/api-keys
 * Generate a new API key for the authenticated tenant.
 * The raw key is returned ONCE and cannot be retrieved again.
 *
 * Requires: JWT authentication (tenant must be logged in)
 */
export async function createApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body as CreateApiKeyInput;

    const { rawKey, apiKey } = await ApiKey.generateKey(
      req.tenantId!,
      name
    );

    logger.info(
      { tenantId: req.tenantId, keyPrefix: apiKey.prefix },
      "API key generated"
    );

    sendCreated(res, {
      apiKey: apiKey.toJSON(),
      rawKey, // ⚠️ Shown ONLY ONCE — tenant must copy this immediately
      warning:
        "Save this key securely. It will not be shown again.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/api-keys
 * List all API keys for the authenticated tenant.
 * Only returns metadata (prefix, name, lastUsedAt), never the key hash.
 */
export async function listApiKeys(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const keys = await ApiKey.find({
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    sendSuccess(res, keys);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /auth/api-keys/:id
 * Revoke (deactivate) an API key.
 */
export async function revokeApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = await ApiKey.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isActive: false },
      { returnDocument: "after" }
    );

    if (!key) {
      throw new AppError("API key not found", 404);
    }

    logger.info(
      { tenantId: req.tenantId, keyId: key._id },
      "API key revoked"
    );

    sendSuccess(res, { message: "API key revoked successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /auth/webhook
 * Update the tenant's webhook URL for receiving events.
 */
export async function updateWebhookUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { webhookUrl } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { webhookUrl },
      { returnDocument: "after" }
    );

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    logger.info({ tenantId: req.tenantId }, "Webhook URL updated");

    sendSuccess(res, {
      tenant: tenant.toJSON(),
      webhookSecret: undefined, // Don't expose; tenant was given this at registration
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/webhook-secret
 * Retrieve the tenant's webhook secret (for signature verification).
 * Only accessible by the authenticated tenant.
 */
export async function getWebhookSecret(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(req.tenantId).select("webhookSecret");

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    sendSuccess(res, {
      webhookSecret: tenant.webhookSecret,
      warning: "Keep this secret secure. Use it to verify webhook signatures.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 * Retrieves the currently authenticated tenant's profile.
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }
    sendSuccess(res, tenant);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/change-password
 * Changes the authenticated tenant's password.
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    const isMatch = await tenant.comparePassword(currentPassword);
    if (!isMatch) throw new UnauthorizedError("Incorrect current password");

    tenant.passwordHash = newPassword; // Will be hashed by pre-save hook
    await tenant.save();

    logger.info({ tenantId: tenant._id }, "Tenant changed password");
    sendSuccess(res, { message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/forgot-password
 * Generates a reset token and sends an email.
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body as ForgotPasswordInput;
    const tenant = await Tenant.findOne({ email });

    // Always send success to prevent email enumeration attacks
    if (!tenant) {
      return sendSuccess(res, {
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const resetToken = tenant.generatePasswordReset();
    await tenant.save();

    const resetUrl = `${env.API_BASE_URL}/reset-password?token=${resetToken}`;
    
    // MOCK EMAIL DELIVERY
    logger.info(
      { email, resetUrl },
      "MOCK EMAIL: Password reset link generated"
    );

    sendSuccess(res, {
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/reset-password
 * Resets the password using a valid reset token.
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword } = req.body as ResetPasswordInput;

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const tenant = await Tenant.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!tenant) {
      throw new AppError("Token is invalid or has expired", 400);
    }

    // Update password
    tenant.passwordHash = newPassword; // Will be hashed by pre-save hook
    tenant.resetPasswordToken = undefined;
    tenant.resetPasswordExpires = undefined;
    await tenant.save();

    logger.info({ tenantId: tenant._id }, "Tenant reset password via token");
    sendSuccess(res, { message: "Password has been successfully reset" });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /auth/payout-settings
 * Update the tenant's automated payout settings.
 */
export async function updatePayoutSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = req.body as UpdatePayoutSettingsInput;

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      {
        $set: {
          payoutSchedule: data.payoutSchedule,
          payoutThreshold: data.payoutThreshold,
          payoutDayOfWeek: data.payoutDayOfWeek,
          payoutDayOfMonth: data.payoutDayOfMonth,
        },
      },
      { returnDocument: "after" }
    );

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    logger.info({ tenantId: req.tenantId }, "Payout settings updated");

    sendSuccess(res, {
      payoutSchedule: tenant.payoutSchedule,
      payoutThreshold: tenant.payoutThreshold,
      payoutDayOfWeek: tenant.payoutDayOfWeek,
      payoutDayOfMonth: tenant.payoutDayOfMonth,
    });
  } catch (error) {
    next(error);
  }
}
