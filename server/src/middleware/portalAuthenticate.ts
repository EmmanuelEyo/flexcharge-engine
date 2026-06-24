import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Customer } from "../models/Customer.js";
import { env } from "../config/environment.js";
import { UnauthorizedError } from "../utils/apiResponse.js";

/**
 * Portal Authentication Middleware.
 *
 * Verifies the short-lived portal JWT that was generated via POST /portal/sessions.
 * This JWT is scoped to a specific customer and tenant.
 *
 * On success: sets req.customerId and req.tenantId on the request.
 *
 * Per implementation_plan.md §4, Layer 2
 */
export async function portalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Portal session token required");
    }

    const token = authHeader.slice(7);

    // Decode with the PORTAL-specific secret (different from tenant JWT secret)
    const decoded = jwt.verify(token, env.PORTAL_JWT_SECRET) as {
      customerId: string;
      tenantId: string;
      type: string;
    };

    // Ensure this is a portal token, not a regular tenant JWT
    if (decoded.type !== "portal") {
      throw new UnauthorizedError("Invalid token type — portal token required");
    }

    // Verify the customer still exists
    const customer = await Customer.findOne({
      _id: decoded.customerId,
      tenantId: decoded.tenantId,
    });

    if (!customer) {
      throw new UnauthorizedError("Customer not found");
    }

    req.customerId = new Types.ObjectId(decoded.customerId);
    req.tenantId = new Types.ObjectId(decoded.tenantId);

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new UnauthorizedError("Invalid or expired portal session token")
      );
    }
    next(error);
  }
}
