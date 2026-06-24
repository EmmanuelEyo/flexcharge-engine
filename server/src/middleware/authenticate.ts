import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Tenant } from "../models/Tenant.js";
import { ApiKey } from "../models/ApiKey.js";
import { env } from "../config/environment.js";
import { UnauthorizedError } from "../utils/apiResponse.js";

/**
 * Authentication middleware.
 *
 * Supports two authentication methods:
 * 1. API Key (x-api-key header) — for server-to-server programmatic access
 * 2. JWT Bearer token (Authorization header) — for dashboard/session access
 *
 * On success: attaches `req.tenantId` to the request.
 * On failure: returns 401 Unauthorized.
 *
 * Per implementation_plan.md §4, Layer 1
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // === METHOD 1: API Key authentication ===
    const apiKeyHeader = req.headers["x-api-key"];
    if (apiKeyHeader && typeof apiKeyHeader === "string") {
      const keyDoc = await ApiKey.findByRawKey(apiKeyHeader);

      if (!keyDoc) {
        throw new UnauthorizedError("Invalid API key");
      }

      // Check if the key has expired
      if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
        throw new UnauthorizedError("API key has expired");
      }

      // Verify the tenant is still active
      const tenant = await Tenant.findOne({
        _id: keyDoc.tenantId,
        isActive: true,
      });

      if (!tenant) {
        throw new UnauthorizedError("Tenant account is deactivated");
      }

      req.tenantId = keyDoc.tenantId;
      return next();
    }

    // === METHOD 2: JWT Bearer token authentication ===
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7); // Remove "Bearer " prefix

      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        tenantId: string;
      };

      // Verify the tenant still exists and is active
      const tenant = await Tenant.findOne({
        _id: decoded.tenantId,
        isActive: true,
      });

      if (!tenant) {
        throw new UnauthorizedError("Tenant account not found or deactivated");
      }

      req.tenantId = new Types.ObjectId(decoded.tenantId);
      return next();
    }

    // === Neither method provided ===
    throw new UnauthorizedError(
      "Authentication required. Provide an API key (x-api-key header) or Bearer token (Authorization header)."
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }

    // JWT verification errors (expired, malformed, etc.)
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }

    next(error);
  }
}

/**
 * JWT-only authentication middleware.
 * Used for sensitive operations like API key management where
 * we require the tenant to be logged in via session, not just API key.
 */
export async function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError(
        "JWT Bearer token required for this operation"
      );
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      tenantId: string;
    };

    const tenant = await Tenant.findOne({
      _id: decoded.tenantId,
      isActive: true,
    });

    if (!tenant) {
      throw new UnauthorizedError("Tenant account not found or deactivated");
    }

    req.tenantId = new Types.ObjectId(decoded.tenantId);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }
    next(error);
  }
}
